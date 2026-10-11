/*
 * @coinsori-strategy v1
 * name: BB RSI Mean Reversion II
 * ex: binance
 * syms: BTCUSDT
 * interval: 15m
 * cash: 10000
 *
 * Why this strategy: Exploits deep overextended price moves by buying when price touches the lower Bollinger Band while RSI is extremely oversold (< 20).
 * When it buys and sells: Buys when close < lower Bollinger Band and RSI(14) < 20, and sells when price reaches the middle SMA or stop-loss triggers.
 * When it does not work: Suffers during strong, prolonged downtrends where the asset continues to trend downward after breaking the lower band.
 */

function onUpdate(ctx) {
    const bb = ctx.bb(20, 2, 1);
    const rsi1 = ctx.rsi(14, 1);
    const close1 = ctx.closes.at(-2);

    if (bb == null || rsi1 == null || close1 == null) {
        return null;
    }

    ctx.watch([
        { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower + RSI < 20', conds: [
            { label: 'RSI(14)', now: parseFloat(rsi1.toFixed(1)), op: '<', ref: 20, closed: true }
        ]},
        { side: 'sell', price: ctx.position > 0 ? ctx.entryPx * 1.03 : bb.middle, trigger: 'above', note: 'Take Profit / Middle BB' }
    ]);

    if (ctx.position > 0) {
        const pnlPct = (ctx.price - ctx.entryPx) / ctx.entryPx;
        if (ctx.price >= bb.middle || pnlPct >= 0.03 || pnlPct <= -0.02) {
            return { side: 'sell', qty: ctx.position };
        }
        return null;
    }

    // Stricter entry: RSI < 20 and price below lower BB
    if (close1 < bb.lower && rsi1 < 20 && ctx.cash > 100) {
        const qty = (ctx.cash / ctx.price) * 0.99;
        return { side: 'buy', qty: qty };
    }

    return null;
}
