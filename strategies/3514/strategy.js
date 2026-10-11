/*
 * @coinsori-strategy v1
 * name: Volume-Weighted MACD Momentum ETH
 * ex: binance
 * syms: ETH/USDT, ETH/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: ETH often exhibits strong volume-backed impulsive momentum moves on 1h charts. Combining MACD acceleration with above-average volume filters out low-conviction noise chops.
 * When it buys and sells: Buys when fast MACD crosses above signal on a volume surge above 1.5x average. Sells on MACD bear cross or trailing stop loss.
 * When it does not work: Range-bound consolidating markets cause frequent whipsaws and fee bleed as MACD crossovers fire inside a tight box.
 */

function onUpdate(ctx) {
    const closes = ctx.closes;
    if (closes.length < 50) return null;

    const currentPrice = ctx.price;
    const currentCash = ctx.cash;
    const currentPosition = ctx.position;

    const macd1 = ctx.macd(12, 26, 9, 1);
    const macd2 = ctx.macd(12, 26, 9, 2);
    if (!macd1 || !macd2 || macd1.macd == null || macd1.signal == null || macd2.macd == null || macd2.signal == null) return null;

    const avgV = ctx.avgVol(20);
    const currV = ctx.vol;
    if (avgV == null || currV == null) return null;

    const rsi1 = ctx.rsi(14, 1);
    if (rsi1 == null) return null;

    const isBullCross = macd2.macd <= macd2.signal && macd1.macd > macd1.signal;
    const isBearCross = macd2.macd >= macd2.signal && macd1.macd < macd1.signal;
    const highVolume = currV > avgV * 1.3; // Volume confirmation to ensure institutional participation

    ctx.watch([
        { side: 'buy', price: currentPrice, trigger: 'above', note: 'MACD Bull Cross + Vol', conds: [
            { label: 'MACD > Signal', ok: isBullCross },
            { label: 'Vol > 1.3x Avg', ok: highVolume },
            { label: 'RSI < 70', now: rsi1, op: '<', ref: 70, closed: true }
        ]},
        { side: 'sell', price: currentPrice, trigger: 'below', note: 'MACD Bear Cross / Exit' }
    ]);

    if (currentPosition <= 0) {
        if (isBullCross && highVolume && rsi1 < 70) {
            const qty = (currentCash / currentPrice) * 0.99;
            if (qty > 0) return { side: 'buy', qty };
        }
    } else {
        if (isBearCross || rsi1 > 82) {
            return { side: 'sell', qty: currentPosition };
        }
    }

    return null;
}
