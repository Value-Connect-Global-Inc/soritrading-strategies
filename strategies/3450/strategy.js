/*
 * @coinsori-strategy v1
 * name: Fed Policy Trend BTC 4h
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Interest rate cycles dictate liquidity conditions for Bitcoin; entering when the macro environment is supportive captures favorable regimes.
 * When it buys and sells: Buys when the 50 SMA is above the 200 SMA; sells when the 50 SMA crosses below the 200 SMA.
 * When it does not work: Suffers during choppy sideways markets or trend whipsaws.
 */

function onUpdate(ctx) {
    const s50 = ctx.sma(50, 1);
    const s200 = ctx.sma(200, 1);
    
    if (s50 == null || s200 == null) return null;
    
    const pos = ctx.position;
    const price = ctx.price;
    if (price == null) return null;
    
    if (pos === 0 || pos == null) {
        if (s50 > s200) {
            ctx.watch([
                { side: 'buy', price: price, trigger: 'above', note: 'SMA50 above SMA200 Trend Bullish', conds: [
                    { label: 'SMA50 > SMA200', ok: true }
                ]}
            ]);
            return { side: 'buy', qty: ctx.cash / price * 0.99 };
        }
    } else {
        if (s50 < s200) {
            ctx.watch([
                { side: 'sell', price: price, trigger: 'below', note: 'SMA50 below SMA200 Trend Bearish' }
            ]);
            return { side: 'sell', qty: pos };
        }
    }
    
    return null;
}
