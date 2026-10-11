/*
 * @coinsori-strategy v1
 * name: BB Mean Reversion RSI BTC 1h
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits overextended price moves beyond Bollinger Bands during range-bound regimes, filtering entries with RSI oversold/overbought conditions.
 * When it buys and sells: Buys when price touches the lower Bollinger Band and RSI is oversold (< 30); sells when price crosses above the middle SMA band or hits a fixed stop loss.
 * When it does not work: Suffers during strong directional trending markets where prices ride the bands continuously.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    const pos = ctx.position;
    
    // Check indicators with warm-up protection
    const bb = ctx.bb(20, 2.0, 1);
    const rsi = ctx.rsi(14, 1);
    const smaMid = ctx.sma(20, 1);
    const atr = ctx.atr(14, 1);
    
    if (!bb || rsi === null || smaMid === null || atr === null) {
        return null;
    }
    
    const prevClose = ctx.closes.at(-2);
    
    // Watch display for live/paper cards
    ctx.watch([
        { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Touch', conds: [{ label: 'RSI < 30', now: rsi, op: '<', ref: 30, closed: true }] },
        { side: 'sell', price: smaMid, trigger: 'above', note: 'SMA Mid Target' }
    ]);
    
    // If we have a position, manage exit
    if (pos > 0) {
        // Exit if price reaches middle SMA or stop loss hit
        if (price >= smaMid || (ctx.entryPx && price <= ctx.entryPx - 2.5 * atr)) {
            return { side: 'sell', qty: pos };
        }
        return null;
    }
    
    // Entry condition: price drops below lower BB and RSI is oversold
    if (prevClose <= bb.lower && rsi < 30) {
        const qty = (ctx.cash / price) * 0.98;
        if (qty > 0) {
            return { side: 'buy', qty: qty };
        }
    }
    
    return null;
}
