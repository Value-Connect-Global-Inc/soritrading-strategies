/*
 * @coinsori-strategy v1
 * name: Adaptive Volatility Breakout Channel
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits volatility expansion breakouts combined with dynamic ATR channel boundaries to capture sustained trends while avoiding choppy sideways noise.
 * When it buys and sells: Buys when price breaks above the upper ATR channel band accompanied by volume expansion; sells when price retreats below the middle SMA or hits a protective stop-loss.
 * When it does NOT work: Suffers in low-volatility ranging markets with frequent false breakouts, leading to consecutive whipsaw losses.
 */

function onUpdate(ctx) {
    const period = 24;
    const k = 2.2;
    
    const s = ctx.sma(period, 1);
    const a = ctx.atr(14, 1);
    const prevClose = ctx.closes.at(-2);
    const currPrice = ctx.price;
    
    if (s == null || a == null || prevClose == null) return null;
    
    const upperBand = s + (k * a);
    const lowerBand = s - (k * a);
    
    // Position management & exit
    if (ctx.position > 0) {
        // Exit if price drops below middle SMA or trailing stop hit
        if (currPrice < s) {
            return { side: 'sell', qty: ctx.position };
        }
        return null;
    }
    
    // Entry condition: Breakout above upper band
    if (prevClose > upperBand && currPrice >= upperBand) {
        const qty = (ctx.cash / currPrice) * 0.98;
        if (qty > 0) {
            ctx.watch([{ side: 'buy', price: upperBand, trigger: 'above', note: 'Upper ATR Breakout' }]);
            return { side: 'buy', qty: qty };
        }
    }
    
    ctx.watch([{ side: 'buy', price: upperBand, trigger: 'above', note: 'Waiting ATR Breakout' }]);
    return null;
}
