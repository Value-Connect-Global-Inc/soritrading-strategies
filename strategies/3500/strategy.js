/*
 * @coinsori-strategy v1
 * name: RSI Bollinger Mean Reversion
 * ex: binance
 * syms: ETH/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: ETH/USDT frequently overreacts to short-term volatility spikes, offering mean-reversion opportunities when price touches Bollinger Band extremes combined with oversold/overbought RSI.
 * When it buys and sells: Buys when RSI(14) is below 30 and price touches or dips below the lower Bollinger Band. Sells when RSI(14) crosses above 55 or touches the upper Bollinger Band.
 * When it does NOT work: Strong sustained trending markets where price rides the Bollinger Bands, causing consecutive whipsaw losses on counter-trend entries.
 */

function onUpdate(ctx) {
    const rsi = ctx.rsi(14, 0);
    const bb = ctx.bb(20, 2, 0);
    const price = ctx.price;

    if (rsi == null || bb == null || price == null) return null;

    // Watch status for live/paper inspection
    ctx.watch([
        { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Touch', conds: [{ label: 'RSI < 30', now: rsi, op: '<', ref: 30, closed: true }] },
        { side: 'sell', price: bb.upper, trigger: 'above', note: 'BB Upper Touch', conds: [{ label: 'RSI > 55', now: rsi, op: '>', ref: 55, closed: true }] }
    ]);

    // Position management
    if (ctx.position > 0) {
        // Exit long when RSI recovers above 55 or upper BB hit
        if (rsi > 55 || price >= bb.upper) {
            return { side: 'sell', qty: ctx.position };
        }
        return null;
    }

    // Entry condition for long
    if (ctx.position === 0 && rsi < 30 && price <= bb.lower) {
        // Allocate 99% of cash
        const qty = (ctx.cash / price) * 0.99;
        return { side: 'buy', qty: qty };
    }

    return null;
}
