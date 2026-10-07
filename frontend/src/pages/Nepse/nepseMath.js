// pure helpers with no react so they are easy to test

const DAY = 864e5;

export const toNum = (v) => {
    const n = Number(v);
    return v == null || v === "" || !Number.isFinite(n) ? null : n;
};

export function pickValue(point) {
    if (typeof point !== "object") return point;

    return (
        point.value ??
        point.close ??
        point.index ??
        point.currentValue ??
        point.y ??
        Object.values(point)[1]
    );
}

// read a timestamp in ms when the point carries one
export function pickTime(point) {
    if (point == null || typeof point !== "object") return null;

    const raw = Array.isArray(point)
        ? point[0]
        : point.time ??
        point.timestamp ??
        point.datetime ??
        point.date ??
        point.businessDate;

    let ms = null;

    if (typeof raw === "number" && Number.isFinite(raw)) {
        ms = raw > 1e12 ? raw : raw > 1e9 ? raw * 1000 : null;
    } else if (typeof raw === "string") {
        const parsed = Date.parse(raw);
        ms = Number.isNaN(parsed) ? null : parsed;
    }

    if (ms == null) return null;

    const year = new Date(ms).getUTCFullYear();
    return year >= 2000 && year <= 2100 ? ms : null;
}

export function parseSeries(raw) {
    if (!Array.isArray(raw) || raw.length < 2) return null;

    const values = [];
    const times = [];

    for (const point of raw) {
        const v = pickValue(point);

        if (typeof v === "number" && !Number.isNaN(v)) {
            values.push(v);
            times.push(pickTime(point));
        }
    }

    return values.length >= 2 ? { values, times } : null;
}

// chart point shape t ms d date text o h l c v
export function pointsFromLine(raw) {
    const series = parseSeries(raw);
    if (!series) return [];

    return series.values.map((v, i) => ({
        t: series.times[i],
        d: null,
        o: v,
        h: v,
        l: v,
        c: v,
        v: null,
    }));
}

const KEYS = {
    o: ["openPrice", "open", "openingPrice"],
    h: ["highPrice", "high", "maxPrice"],
    l: ["lowPrice", "low", "minPrice"],
    c: ["closePrice", "close", "lastTradedPrice", "ltp"],
    v: ["totalTradeQuantity", "totalTradedQuantity", "volume", "shareTraded"],
    p: ["previousDayClosePrice", "previousClose", "previousClosePrice"],
};

function firstNum(row, keys) {
    for (const key of keys) {
        const n = toNum(row?.[key]);
        if (n !== null) return n;
    }

    return null;
}

// daily history rows to sorted ohlc points
// derived is true when most rows had no high and low
export function pointsFromHistory(history) {
    if (!Array.isArray(history) || history.length < 2) {
        return { points: [], derived: false };
    }

    const rows = [];

    for (const r of history) {
        if (!r || typeof r !== "object") continue;

        const date = r.businessDate ?? r.date ?? r.tradeDate ?? null;
        const t = typeof date === "string" ? Date.parse(date) : NaN;
        const c = firstNum(r, KEYS.c);

        if (!Number.isFinite(t) || c === null) continue;

        rows.push({
            t,
            d: String(date).slice(0, 10),
            c,
            o: firstNum(r, KEYS.o),
            h: firstNum(r, KEYS.h),
            l: firstNum(r, KEYS.l),
            v: firstNum(r, KEYS.v),
            p: firstNum(r, KEYS.p),
        });
    }

    rows.sort((a, b) => a.t - b.t);

    let real = 0;

    const points = rows.map((r, i) => {
        const prev = i > 0 ? rows[i - 1].c : null;
        const o = r.o ?? r.p ?? prev ?? r.c;

        if (r.h !== null && r.l !== null) real += 1;

        const h = Math.max(r.h ?? o, o, r.c);
        const l = Math.min(r.l ?? o, o, r.c);

        return { t: r.t, d: r.d, o, h, l, c: r.c, v: r.v };
    });

    return { points, derived: real < points.length / 2 };
}

export const RANGE_DAYS = { "1M": 31, "3M": 92, "6M": 183, "1Y": 366 };

export function sliceRange(points, key) {
    const days = RANGE_DAYS[key];

    if (!days || points.length < 3) return points;

    const cut = points[points.length - 1].t - days * DAY;
    const from = points.findIndex((p) => p.t >= cut);
    const out = from < 0 ? points : points.slice(from);

    return out.length < 2 ? points.slice(-2) : out;
}

/* indicators */

export function sma(values, n) {
    const out = new Array(values.length).fill(null);
    let sum = 0;

    for (let i = 0; i < values.length; i++) {
        sum += values[i];
        if (i >= n) sum -= values[i - n];
        if (i >= n - 1) out[i] = sum / n;
    }

    return out;
}

export function ema(values, n) {
    const out = new Array(values.length).fill(null);
    if (values.length < n) return out;

    const k = 2 / (n + 1);
    let prev = 0;

    for (let i = 0; i < n; i++) prev += values[i];
    prev /= n;
    out[n - 1] = prev;

    for (let i = n; i < values.length; i++) {
        prev = values[i] * k + prev * (1 - k);
        out[i] = prev;
    }

    return out;
}

export function bollinger(values, n = 20, mult = 2) {
    const mid = sma(values, n);
    const up = new Array(values.length).fill(null);
    const low = new Array(values.length).fill(null);

    for (let i = n - 1; i < values.length; i++) {
        let variance = 0;

        for (let j = i - n + 1; j <= i; j++) {
            variance += (values[j] - mid[i]) ** 2;
        }

        const dev = Math.sqrt(variance / n) * mult;
        up[i] = mid[i] + dev;
        low[i] = mid[i] - dev;
    }

    return { mid, up, low };
}

// wilder smoothing
export function rsi(values, n = 14) {
    const out = new Array(values.length).fill(null);
    if (values.length <= n) return out;

    let gain = 0;
    let loss = 0;

    for (let i = 1; i <= n; i++) {
        const d = values[i] - values[i - 1];
        if (d >= 0) gain += d;
        else loss -= d;
    }

    gain /= n;
    loss /= n;
    out[n] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);

    for (let i = n + 1; i < values.length; i++) {
        const d = values[i] - values[i - 1];

        gain = (gain * (n - 1) + (d > 0 ? d : 0)) / n;
        loss = (loss * (n - 1) + (d < 0 ? -d : 0)) / n;
        out[i] = loss === 0 ? 100 : 100 - 100 / (1 + gain / loss);
    }

    return out;
}

export function atr(points, n = 14) {
    const out = new Array(points.length).fill(null);
    if (points.length <= n) return out;

    const tr = (i) => {
        const p = points[i];
        const prev = points[i - 1].c;

        return Math.max(p.h - p.l, Math.abs(p.h - prev), Math.abs(p.l - prev));
    };

    let value = 0;

    for (let i = 1; i <= n; i++) value += tr(i);
    value /= n;
    out[n] = value;

    for (let i = n + 1; i < points.length; i++) {
        value = (value * (n - 1) + tr(i)) / n;
        out[i] = value;
    }

    return out;
}

// classic floor pivots from one session
export function pivots(p) {
    const mid = (p.h + p.l + p.c) / 3;
    const span = p.h - p.l;

    return {
        r3: p.h + 2 * (mid - p.l),
        r2: mid + span,
        r1: 2 * mid - p.l,
        p: mid,
        s1: 2 * mid - p.h,
        s2: mid - span,
        s3: p.l - 2 * (p.h - mid),
    };
}

export function stdev(list) {
    if (list.length < 2) return null;

    const mean = list.reduce((a, b) => a + b, 0) / list.length;
    const variance =
        list.reduce((a, b) => a + (b - mean) ** 2, 0) / (list.length - 1);

    return Math.sqrt(variance);
}

// percent change from the last session at or before days ago
export function returnSince(points, days) {
    if (points.length < 2) return null;

    const last = points[points.length - 1];
    const cut = last.t - days * DAY;

    for (let i = points.length - 2; i >= 0; i--) {
        if (points[i].t <= cut) {
            return points[i].c ? (last.c / points[i].c - 1) * 100 : null;
        }
    }

    return null;
}

export function computeStats(points) {
    if (points.length < 2) return null;

    const closes = points.map((p) => p.c);
    const last = points[points.length - 1];
    const a = atr(points, 14).at(-1);

    let hi = -Infinity;
    let lo = Infinity;

    for (const p of points) {
        if (p.h > hi) hi = p.h;
        if (p.l < lo) lo = p.l;
    }

    const vols = points
        .slice(-20)
        .map((p) => p.v)
        .filter((v) => v != null);

    const rets = [];

    for (let i = Math.max(1, points.length - 30); i < points.length; i++) {
        if (points[i - 1].c) {
            rets.push((points[i].c / points[i - 1].c - 1) * 100);
        }
    }

    return {
        last,
        rsi: rsi(closes, 14).at(-1),
        sma20: sma(closes, 20).at(-1),
        sma50: sma(closes, 50).at(-1),
        atr: a,
        atrPct: a && last.c ? (a / last.c) * 100 : null,
        hi,
        lo,
        fromHigh: hi ? (last.c / hi - 1) * 100 : null,
        fromLow: lo ? (last.c / lo - 1) * 100 : null,
        avgVol: vols.length ? vols.reduce((x, y) => x + y, 0) / vols.length : null,
        vol: stdev(rets),
        returns: {
            "1W": returnSince(points, 7),
            "1M": returnSince(points, 30),
            "3M": returnSince(points, 91),
            "6M": returnSince(points, 182),
            "1Y": returnSince(points, 365),
        },
        pivots: pivots(last),
    };
}

/* chart helpers */

export function niceTicks(lo, hi, count = 4) {
    const range = hi - lo || 1;
    const raw = range / count;
    const mag = 10 ** Math.floor(Math.log10(raw));
    const norm = raw / mag;
    const step = (norm < 1.5 ? 1 : norm < 3 ? 2 : norm < 7 ? 5 : 10) * mag;
    const ticks = [];

    for (let v = Math.ceil(lo / step) * step; v <= hi + step * 1e-6; v += step) {
        ticks.push(Number(v.toFixed(10)));
    }

    return ticks;
}

// merge points into bars anchored to absolute index multiples
// so bars do not reshuffle while panning
export function groupBars(points, start, size, maxBars) {
    const total = points.length;
    const i0 = Math.max(0, Math.floor(start));
    const i1 = Math.min(total, Math.ceil(start + size));
    const count = Math.max(0, i1 - i0);
    const g = Math.max(1, Math.ceil(count / Math.max(1, maxBars)));
    const bars = [];

    for (let s = Math.floor(i0 / g) * g; s < i1; s += g) {
        const e = Math.min(total, s + g) - 1;
        const first = points[s];
        const lastP = points[e];

        let h = -Infinity;
        let l = Infinity;
        let vol = null;

        for (let k = s; k <= e; k++) {
            const p = points[k];

            if (p.h > h) h = p.h;
            if (p.l < l) l = p.l;
            if (p.v != null) vol = (vol ?? 0) + p.v;
        }

        bars.push({
            s,
            e,
            o: first.o,
            h,
            l,
            c: lastP.c,
            v: vol,
            t: lastP.t,
            d: lastP.d,
        });
    }

    return { bars, g };
}

/* floorsheet helpers */

export function aggregateBrokers(rows) {
    const map = new Map();

    const touch = (id) => {
        if (!map.has(id)) {
            map.set(id, { id, buy: 0, sell: 0, buyAmt: 0, sellAmt: 0 });
        }

        return map.get(id);
    };

    for (const r of rows ?? []) {
        const qty = toNum(r.contractQuantity ?? r.quantity);
        if (!qty) continue;

        const rate = toNum(r.contractRate ?? r.rate);
        const amt = toNum(r.contractAmount) ?? (rate != null ? qty * rate : 0);
        const buyer = r.buyerMemberId ?? r.buyerBroker;
        const seller = r.sellerMemberId ?? r.sellerBroker;

        if (buyer != null) {
            const x = touch(String(buyer));
            x.buy += qty;
            x.buyAmt += amt;
        }

        if (seller != null) {
            const x = touch(String(seller));
            x.sell += qty;
            x.sellAmt += amt;
        }
    }

    return [...map.values()].map((x) => ({ ...x, net: x.buy - x.sell }));
}

export function floorStats(rows) {
    let contracts = 0;
    let qty = 0;
    let amount = 0;
    let largest = 0;

    for (const r of rows ?? []) {
        const q = toNum(r.contractQuantity ?? r.quantity);
        const rate = toNum(r.contractRate ?? r.rate);
        if (!q) continue;

        contracts += 1;
        qty += q;
        amount += toNum(r.contractAmount) ?? (rate != null ? q * rate : 0);
        if (q > largest) largest = q;
    }

    return {
        contracts,
        qty,
        amount,
        largest,
        vwap: qty ? amount / qty : null,
    };
}

/* trade cost model
   rates differ by broker and change over time
   so keep them here in one place and let users verify */

export const FEES = {
    tiers: [
        [50000, 0.0036],
        [500000, 0.0033],
        [2000000, 0.0031],
        [10000000, 0.0027],
        [Infinity, 0.0024],
    ],
    minCommission: 10,
    flatUpTo: 2500,
    sebon: 0.00015,
    dp: 25,
    cgtShort: 0.075,
    cgtLong: 0.05,
};

export function commission(amount) {
    if (!(amount > 0)) return 0;
    if (amount <= FEES.flatUpTo) return FEES.minCommission;

    const tier = FEES.tiers.find(([cap]) => amount <= cap);

    return Math.max(FEES.minCommission, amount * tier[1]);
}

export function buyCost(price, qty) {
    const amt = price * qty;
    const comm = commission(amt);
    const sebon = amt * FEES.sebon;
    const total = amt + comm + sebon;

    return { amt, comm, sebon, total, perShare: qty ? total / qty : 0 };
}

export function sellProceeds(price, qty) {
    const amt = price * qty;
    const comm = commission(amt);
    const sebon = amt * FEES.sebon;
    const dp = amt > 0 ? FEES.dp : 0;

    return { amt, comm, sebon, dp, net: amt - comm - sebon - dp };
}

export function tradeResult({ buy, sell, qty, long = false }) {
    const b = buyCost(buy, qty);
    const s = sellProceeds(sell, qty);
    const gain = s.net - b.total;
    const cgt = gain > 0 ? gain * (long ? FEES.cgtLong : FEES.cgtShort) : 0;
    const net = gain - cgt;

    return { b, s, gain, cgt, net, roi: b.total ? (net / b.total) * 100 : 0 };
}

// lowest sell price that returns the full buy cost
export function breakEven(buy, qty) {
    if (!(buy > 0) || !(qty > 0)) return null;

    const total = buyCost(buy, qty).total;
    let lo = 0;
    let hi = (total / qty) * 2 + 10;

    for (let i = 0; i < 60; i++) {
        const mid = (lo + hi) / 2;

        if (sellProceeds(mid, qty).net >= total) hi = mid;
        else lo = mid;
    }

    return hi;
}