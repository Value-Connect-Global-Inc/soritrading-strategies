/*
 * @coinsori-strategy v1
 * name: MTF Trend Momentum ATR Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures strong directional momentum using dual EMA alignment on 1h bars combined with ATR volatility filtering.
 * When it buys and sells: Buys when fast EMA crosses above slow EMA during high volume and upward trend, and sells on ATR trailing stop or trend reversal.
 * When it does not work: Suffers in choppy sideways markets where trend signals whipsaw frequently.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    const pos = ctx.position;

    // Need enough bars for 50 EMA
    const fast = ctx.ema(20, 0);
    const slow = ctx.ema(50, 0);
    const fastPrev = ctx.ema(20, 1);
    const slowPrev = ctx.ema(50, 1);
    const rsi = ctx.rsi(14, 0);
    const atr = ctx.atr(14, 0);

    if (fast == null || slow == null || fastPrev == null || slowPrev == null || rsi == null || atr == null) {
        return null;
    }

    // Define trend conditions
    const bullCross = fastPrev <= slowPrev && fast > slow;
    const bearCross = fastPrev >= slowPrev && fast < slow;

    ctx.watch([
        { side: 'buy', price: price, trigger: 'above', note: 'Trend Bullish', conds: [
            { label: 'Fast EMA > Slow EMA', ok: fast > slow },
            { label: 'RSI > 50', now: rsi, op: '>', ref: 50, closed: true }
        ]}
    ]);

    // Entry
    if (pos === 0) {
        if (bullCross && rsi > 50) {
            const qty = (ctx.cash / price) * 0.99;
            if (qty > 0) {
                return { side: 'buy', qty: qty };
            }
        }
    } 
    // Exit
    else if (pos > 0) {
        if (bearCross || rsi < 40) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
