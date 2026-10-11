/*
 * @coinsori-strategy v1
 * name: EMA Crossover Momentum
 * ex: binance
 * syms: BTCUSDT
 * interval: 15m
 * cash: 10000
 *
 * Why this strategy: Captures trend momentum by entering when short-term EMA crosses above long-term EMA, filtered by RSI.
 * When it buys and sells: Buys when EMA(9) crosses above EMA(21) and RSI(14) > 50, and sells on bearish crossover or stop-loss.
 * When it does not work: Suffers in choppy, sideways markets where frequent false crossovers generate whipsaw losses.
 */

function onUpdate(ctx) {
    const e9_1 = ctx.ema(9, 1);
    const e9_2 = ctx.ema(9, 2);
    const e21_1 = ctx.ema(21, 1);
    const e21_2 = ctx.ema(21, 2);
    const rsi1 = ctx.rsi(14, 1);

    if (e9_1 == null || e9_2 == null || e21_1 == null || e21_2 == null || rsi1 == null) {
        return null;
    }

    ctx.watch([
        { side: 'buy', price: ctx.price, trigger: 'above', note: 'EMA Crossover + RSI > 50', conds: [
            { label: 'RSI(14)', now: parseFloat(rsi1.toFixed(1)), op: '>', ref: 50, closed: true }
        ]},
        { side: 'sell', price: ctx.position > 0 ? ctx.entryPx * 0.98 : ctx.price, trigger: 'below', note: 'Stop Loss / Cross Under' }
    ]);

    if (ctx.position > 0) {
        const pnlPct = (ctx.price - ctx.entryPx) / ctx.entryPx;
        if ((e9_2 >= e21_2 && e9_1 < e21_1) || pnlPct <= -0.015 || pnlPct >= 0.03) {
            return { side: 'sell', qty: ctx.position };
        }
        return null;
    }

    // Bullish crossover with RSI filter
    if (e9_2 <= e21_2 && e9_1 > e21_1 && rsi1 > 50 && ctx.cash > 100) {
        const qty = (ctx.cash / ctx.price) * 0.99;
        return { side: 'buy', qty: qty };
    }

    return null;
}
