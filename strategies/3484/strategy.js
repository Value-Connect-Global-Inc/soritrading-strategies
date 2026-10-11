/*
 * @coinsori-strategy v1
 * name: AtrVolatilityBreakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures strong directional momentum when price breaks out of an ATR-based volatility channel.
 * When it buys and sells: Buys when price closes above the upper ATR channel band; sells when price falls below the trailing stop or lower band.
 * When it does NOT work: Suffers in choppy, range-bound markets with frequent false breakouts.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    const closes = ctx.closes;
    if (closes.length < 50) return null;

    // Use ATR to measure volatility and set dynamic channel bands around SMA(20)
    const sma20 = ctx.sma(20, 0);
    const atr14 = ctx.atr(14, 0);
    const prevClose = closes.at(-2);
    const prevSma = ctx.sma(20, 1);
    const prevAtr = ctx.atr(14, 1);

    if (sma20 == null || atr14 == null || prevSma == null || prevAtr == null) return null;

    const upperBand = prevSma + (prevAtr * 1.5);
    const lowerBand = prevSma - (prevAtr * 1.5);

    const pos = ctx.position;

    // Watch conditions for display card
    ctx.watch([
        { side: 'buy', price: upperBand, trigger: 'above', note: 'ATR Breakout Upper', conds: [
            { label: 'Close > UpperBand', now: prevClose, op: '>', ref: upperBand, closed: true }
        ]},
        { side: 'sell', price: lowerBand, trigger: 'below', note: 'ATR Breakout Lower', conds: [
            { label: 'Close < LowerBand', now: prevClose, op: '<', ref: lowerBand, closed: true }
        ]}
    ]);

    if (pos === 0) {
        // Buy condition: breakout above upper band
        if (prevClose > upperBand) {
            const qty = (ctx.cash * 0.98) / p;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Sell condition: breakdown below lower band or trailing stop
        if (prevClose < lowerBand || p < ctx.entryPx * 0.95) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
