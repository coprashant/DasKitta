import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { getPriceVolume, isNepseError } from "../../api/nepse";

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