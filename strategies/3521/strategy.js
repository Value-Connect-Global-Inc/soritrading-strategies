/*
 * @coinsori-strategy v1
 * name: Multi-Timeframe Trend Confirmation 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Filters out fakeouts by requiring both fast and slow EMA alignment along with RSI confirmation on the 4h chart.
 * When it buys and sells: Buys when EMA20 crosses above EMA50 and RSI > 55; sells when EMA20 crosses below EMA50 or RSI drops below 45.
 * When it does not work: Suffers in choppy, sideways markets where moving averages whipsaw frequently.
 */

function onUpdate(ctx) {
    const closes = ctx.closes;
    if (closes == null || closes.length < 60) return null;

    const p = ctx.price;
    const ema20_now = ctx.ema(20, 0);
    const ema20_prev = ctx.ema(20, 1);
    const ema50_now = ctx.ema(50, 0);
    const ema50_prev = ctx.ema(50, 1);
    const rsi14 = ctx.rsi(14, 0);

    if (ema20_now == null || ema20_prev == null || ema50_now == null || ema50_prev == null || rsi14 == null) {
        return null;
    }

    const pos = ctx.position;

    // Watch conditions
    ctx.watch([
        { side: 'buy', price: ema20_now, trigger: 'above', note: 'EMA20 > EMA50 Cross', conds: [
            { label: 'RSI > 55', now: rsi14, op: '>', ref: 55, closed: true }
        ]},
        { side: 'sell', price: ema20_now, trigger: 'below', note: 'EMA20 < EMA50 Cross', conds: [
            { label: 'RSI < 45', now: rsi14, op: '<', ref: 45, closed: true }
        ]}
    ]);

    // Entry: EMA20 crosses above EMA50 and RSI > 55
    if (pos === 0 || pos == null) {
        if (ema20_prev <= ema50_prev && ema20_now > ema50_now && rsi14 > 55) {
            const qty = (ctx.cash / p) * 0.99;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Exit: EMA20 crosses below EMA50 or RSI < 45
        if ((ema20_prev >= ema50_prev && ema20_now < ema50_now) || rsi14 < 45) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
