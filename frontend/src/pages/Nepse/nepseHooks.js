import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getPriceVolume, isNepseError } from "../../api/nepse";
import { fmt } from "./nepseUtils";
import { toNum } from "./nepseMath";

export function useClock() {
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const id = setInterval(() => setNow(new Date()), 1000);
        return () => clearInterval(id);
    }, []);

    return now;
}

export function useDragScroll() {
    const ref = useRef(null);
    const dragRef = useRef({ active: false, startX: 0, scrollLeft: 0 });

    const onPointerDown = useCallback((e) => {
        const el = ref.current;
        if (!el) return;
        dragRef.current = {
            active: true,
            startX: e.pageX - el.offsetLeft,
            scrollLeft: el.scrollLeft,
        };
        el.setPointerCapture?.(e.pointerId);
    }, []);

    const onPointerUp = useCallback((e) => {
        dragRef.current.active = false;
        try {
            ref.current?.releasePointerCapture?.(e.pointerId);
        } catch {
            return;
        }
    }, []);

    const onPointerMove = useCallback((e) => {
        const el = ref.current;
        const drag = dragRef.current;
        if (!el || !drag.active) return;
        const x = e.pageX - el.offsetLeft;
        el.scrollLeft = drag.scrollLeft - (x - drag.startX) * 1.5;
    }, []);

    const handlers = useMemo(
        () => ({
            onPointerDown,
            onPointerUp,
            onPointerCancel: onPointerUp,
            onPointerMove,
        }),
        [onPointerDown, onPointerUp, onPointerMove]
    );

    return { ref, handlers };
}


// shared price volume cache so one request serves search and market widgets
const PV_TTL = 30000;
const pvCache = { at: 0, rows: null, promise: null };

// resolves with rows or rejects when nothing usable is cached
export function loadPriceVolume({ force = false } = {}) {
    const fresh = pvCache.rows && Date.now() - pvCache.at < PV_TTL;

    if (!force && fresh) return Promise.resolve(pvCache.rows);
    if (pvCache.promise) return pvCache.promise;

    pvCache.promise = getPriceVolume()
        .then((res) => {
            const rows =
                !isNepseError(res.data) && Array.isArray(res.data)
                    ? res.data
                    : [];

            if (rows.length) {
                pvCache.rows = rows;
                pvCache.at = Date.now();
                return rows;
            }

            if (pvCache.rows) return pvCache.rows;

            throw new Error("Price data is unavailable");
        })
        .catch((err) => {
            if (pvCache.rows) return pvCache.rows;
            throw err;
        })
        .finally(() => {
            pvCache.promise = null;
        });

    return pvCache.promise;
}

export function usePriceVolume(refreshMs = 0) {
    const [rows, setRows] = useState(pvCache.rows ?? []);
    const [loading, setLoading] = useState(!pvCache.rows);
    const [error, setError] = useState(null);
    const aliveRef = useRef(true);

    const run = useCallback((force) => {
        return loadPriceVolume({ force })
            .then((next) => {
                if (aliveRef.current) {
                    setRows(next);
                    setError(null);
                }

                return next;
            })
            .catch(() => {
                if (aliveRef.current) {
                    setError("Stock prices could not be loaded");
                }

                return [];
            })
            .finally(() => {
                if (aliveRef.current) setLoading(false);
            });
    }, []);

    useEffect(() => {
        aliveRef.current = true;
        run(false);

        let id = null;

        if (refreshMs > 0) {
            id = window.setInterval(() => {
                if (document.visibilityState === "visible") run(true);
            }, refreshMs);
        }

        return () => {
            aliveRef.current = false;
            if (id !== null) window.clearInterval(id);
        };
    }, [refreshMs, run]);

    const refresh = useCallback(() => {
        setLoading((current) => current || !pvCache.rows);
        return run(true);
    }, [run]);

    return { rows, loading, error, refresh };
}

// watchlist kept in local storage and synced across components
const WATCH_KEY = "nepse_watchlist_v1";
const WATCH_EVENT = "nepse-watchlist-change";
const WATCH_LIMIT = 50;

function readWatchlist() {
    try {
        const raw = window.localStorage.getItem(WATCH_KEY);
        const parsed = raw ? JSON.parse(raw) : [];

        return Array.isArray(parsed)
            ? parsed.filter((item) => typeof item === "string")
            : [];
    } catch {
        return [];
    }
}

export function useWatchlist() {
    const [list, setList] = useState(readWatchlist);

    useEffect(() => {
        const sync = () => setList(readWatchlist());

        window.addEventListener(WATCH_EVENT, sync);
        window.addEventListener("storage", sync);

        return () => {
            window.removeEventListener(WATCH_EVENT, sync);
            window.removeEventListener("storage", sync);
        };
    }, []);

    const toggle = useCallback((symbol) => {
        const sym = String(symbol ?? "").toUpperCase();
        if (!sym) return;

        const current = readWatchlist();
        const next = current.includes(sym)
            ? current.filter((item) => item !== sym)
            : [...current, sym].slice(-WATCH_LIMIT);

        let saved = true;

        try {
            window.localStorage.setItem(WATCH_KEY, JSON.stringify(next));
        } catch {
            saved = false;
        }

        setList(next);
        // skip the sync event when storage failed so state is not reverted
        if (saved) window.dispatchEvent(new Event(WATCH_EVENT));
    }, []);

    const has = useCallback(
        (symbol) => list.includes(String(symbol ?? "").toUpperCase()),
        [list]
    );

    return { list, has, toggle };
}

// small local storage list store shared by portfolio and alerts
function makeStore(key, event, normalize) {
    const read = () => {
        try {
            const raw = window.localStorage.getItem(key);
            return normalize(raw ? JSON.parse(raw) : []);
        } catch {
            return [];
        }
    };

    const write = (next) => {
        try {
            window.localStorage.setItem(key, JSON.stringify(next));
            window.dispatchEvent(new Event(event));
        } catch {
            // storage full or blocked keep state in memory only
        }
    };

    return { read, write, event };
}

function useStore(store) {
    const [list, setList] = useState(store.read);

    useEffect(() => {
        const sync = () => setList(store.read());

        window.addEventListener(store.event, sync);
        window.addEventListener("storage", sync);

        return () => {
            window.removeEventListener(store.event, sync);
            window.removeEventListener("storage", sync);
        };
    }, [store]);

    // updater returns the same array when nothing changed
    const commit = useCallback(
        (updater) => {
            const current = store.read();
            const next = updater(current);

            if (next === current) return;

            store.write(next);
            setList(next);
        },
        [store]
    );

    return [list, commit];
}

const upper = (v) => String(v ?? "").trim().toUpperCase();

// portfolio holdings
const portfolioStore = makeStore(
    "nepse_portfolio_v1",
    "nepse-portfolio-change",
    (parsed) =>
        Array.isArray(parsed)
            ? parsed
                .filter(
                    (h) =>
                        h &&
                        typeof h.symbol === "string" &&
                        Number(h.qty) > 0 &&
                        Number(h.cost) >= 0
                )
                .map((h) => ({
                    symbol: upper(h.symbol),
                    qty: Number(h.qty),
                    cost: Number(h.cost),
                }))
            : []
);

export function usePortfolio() {
    const [list, commit] = useStore(portfolioStore);

    // adding to an existing symbol blends the average cost
    const add = useCallback(
        (symbol, qty, cost) => {
            const sym = upper(symbol);
            const q = Number(qty);
            const c = Number(cost);

            if (!sym || !(q > 0) || !(c >= 0)) return;

            commit((cur) => {
                const i = cur.findIndex((h) => h.symbol === sym);

                if (i < 0) return [...cur, { symbol: sym, qty: q, cost: c }].slice(-60);

                const old = cur[i];
                const total = old.qty + q;
                const avg = (old.qty * old.cost + q * c) / total;

                return cur.map((h, j) =>
                    j === i ? { ...h, qty: total, cost: avg } : h
                );
            });
        },
        [commit]
    );

    const remove = useCallback(
        (symbol) => {
            const sym = upper(symbol);
            commit((cur) => cur.filter((h) => h.symbol !== sym));
        },
        [commit]
    );

    return { list, add, remove };
}

// price alerts
const alertStore = makeStore(
    "nepse_alerts_v1",
    "nepse-alerts-change",
    (parsed) =>
        Array.isArray(parsed)
            ? parsed
                .filter(
                    (a) =>
                        a &&
                        typeof a.symbol === "string" &&
                        (a.dir === "above" || a.dir === "below") &&
                        Number(a.price) > 0
                )
                .map((a) => ({
                    id: String(a.id ?? `${a.symbol}-${a.dir}-${a.price}`),
                    symbol: upper(a.symbol),
                    dir: a.dir,
                    price: Number(a.price),
                    createdAt: Number(a.createdAt) || Date.now(),
                    triggeredAt: a.triggeredAt ? Number(a.triggeredAt) : null,
                    hit: a.hit != null ? Number(a.hit) : null,
                    seen: Boolean(a.seen),
                }))
            : []
);

function notifyHits(hits) {
    if (typeof Notification === "undefined") return;
    if (Notification.permission !== "granted") return;

    for (const h of hits) {
        try {
            new Notification(`${h.symbol} ${h.dir} ${fmt(h.price)}`, {
                body: `last price ${fmt(h.hit)}`,
            });
        } catch {
            // some browsers block the constructor ignore
        }
    }
}

export function useAlerts() {
    const [list, commit] = useStore(alertStore);

    const add = useCallback(
        (symbol, dir, price) => {
            const sym = upper(symbol);
            const p = Number(price);

            if (!sym || !(p > 0) || (dir !== "above" && dir !== "below")) return;

            commit((cur) =>
                [
                    ...cur,
                    {
                        id: `${Date.now().toString(36)}${Math.random()
                            .toString(36)
                            .slice(2, 6)}`,
                        symbol: sym,
                        dir,
                        price: p,
                        createdAt: Date.now(),
                        triggeredAt: null,
                        hit: null,
                        seen: false,
                    },
                ].slice(-60)
            );
        },
        [commit]
    );

    const remove = useCallback(
        (id) => commit((cur) => cur.filter((a) => a.id !== id)),
        [commit]
    );

    const dismiss = useCallback(
        (id) =>
            commit((cur) =>
                cur.map((a) => (a.id === id ? { ...a, seen: true } : a))
            ),
        [commit]
    );

    const rearm = useCallback(
        (id) =>
            commit((cur) =>
                cur.map((a) =>
                    a.id === id
                        ? { ...a, triggeredAt: null, hit: null, seen: false }
                        : a
                )
            ),
        [commit]
    );

    // compare live prices with every armed alert
    const check = useCallback(
        (rows) => {
            if (!Array.isArray(rows) || !rows.length) return;

            const live = new Map(
                rows.map((r) => [
                    upper(r.symbol),
                    toNum(r.lastTradedPrice ?? r.closePrice),
                ])
            );

            const hits = [];

            commit((cur) => {
                const next = cur.map((a) => {
                    if (a.triggeredAt) return a;

                    const price = live.get(a.symbol);
                    if (price == null) return a;

                    const hit =
                        a.dir === "above" ? price >= a.price : price <= a.price;

                    if (!hit) return a;

                    hits.push({ ...a, hit: price });

                    return { ...a, triggeredAt: Date.now(), hit: price, seen: false };
                });

                return hits.length ? next : cur;
            });

            if (hits.length) notifyHits(hits);
        },
        [commit]
    );

    return { list, add, remove, dismiss, rearm, check };
}