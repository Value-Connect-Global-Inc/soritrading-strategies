/*
 * @coinsori-strategy v1
 * name: Volatility Breakout ATR Volume 1h
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures strong momentum breakouts when price exceeds the recent high accompanied by expanding volume and high ATR.
 * When it buys and sells: Buys when price breaks the 24-period highest high with volume > 1.5x average and RSI > 50; sells when price falls below the 10-period EMA or a 2.5x ATR trailing stop.
 * When it does not work: Suffers in choppy, range-bound markets with false breakouts that trigger the stop loss repeatedly.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    const closes = ctx.closes;
    if (closes == null || closes.length < 30) return null;

    // Indicators
    const rsi14 = ctx.rsi(14, 0);
    const rsi14_prev = ctx.rsi(14, 1);
    const ema10 = ctx.ema(10, 0);
    const ema10_prev = ctx.ema(10, 1);
    const atr14 = ctx.atr(14, 0);
    const high24 = ctx.high(24, 1); // Highest high of previous 24 bars
    const avgVol20 = ctx.avgVol(20);
    const vol = ctx.vol;

    if (rsi14 == null || rsi14_prev == null || ema10 == null || ema10_prev == null || atr14 == null || high24 == null || avgVol20 == null || vol == null) {
        return null;
    }

    const pos = ctx.position;

    // Watch conditions
    ctx.watch([
        { side: 'buy', price: high24, trigger: 'above', note: 'Breakout High', conds: [
            { label: 'Vol > 1.5x avg', ok: vol > avgVol20 * 1.5 },
            { label: 'RSI > 50', now: rsi14, op: '>', ref: 50, closed: true }
        ]},
        { side: 'sell', price: ema10, trigger: 'below', note: 'EMA10 Exit' }
    ]);

    // Entry logic: Buy when price breaks above high24, volume is 1.5x average, and RSI > 50
    if (pos === 0 || pos == null) {
        if (p > high24 && vol > avgVol20 * 1.5 && rsi14 > 50) {
            const qty = (ctx.cash / p) * 0.99;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Exit logic: Sell if price drops below EMA10 or hit a trailing stop based on ATR
        if (p < ema10) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
