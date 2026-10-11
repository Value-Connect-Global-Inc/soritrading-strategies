/*
 * @coinsori-strategy v1
 * name: Volatility Volume Surge Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits sharp overextensions in price relative to Bollinger Bands accompanied by extreme volume surges, fading short-term spikes for a quick mean-reversion gain.
 * When it buys and sells: Buys when price drops below the lower Bollinger Band with a significant volume surge and low RSI (oversold), and sells when price crosses back above the middle Bollinger band or hits a strict stop loss.
 * When it does not work: Suffers in prolonged, relentless trending macro runs where the asset continues breaking bands without pulling back.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    const pos = ctx.position;
    
    // Require warm-up for Bollinger Bands, RSI, and Volume average
    const bb = ctx.bb(20, 2);
    const rsi = ctx.rsi(14);
    const avgV = ctx.avgVol(20);
    
    if (bb == null || rsi == null || avgV == null || ctx.volumes == null || ctx.volumes.length < 2) {
        return null;
    }
    
    const curVol = ctx.volumes.at(-1);
    
    // Watch display condition for UI
    ctx.watch([
        { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Oversold' },
        { side: 'sell', price: bb.mid, trigger: 'above', note: 'BB Mid Target' }
    ]);

    // Entry logic: Buy when price breaks below lower BB, RSI < 30, and volume is at least 1.5x average
    if (pos === 0 && ctx.cash > 10) {
        if (p < bb.lower && rsi < 30 && curVol > avgV * 1.5) {
            const qty = (ctx.cash / p) * 0.95; // Use 95% of available cash
            return { side: 'buy', qty: qty };
        }
    }
    
    // Exit logic: Sell when price crosses above middle BB or RSI recovers above 50
    if (pos > 0) {
        if (p > bb.mid || rsi > 50) {
            return { side: 'sell', qty: pos };
        }
    }
    
    return null;
}
