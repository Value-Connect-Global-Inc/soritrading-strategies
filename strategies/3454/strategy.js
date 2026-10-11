/*
 * @coinsori-strategy v1
 * name: Clean Trend Momentum BTC 1h
 * ex: binance
 * syms: BTCUSDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures strong medium-term trends on 1h BTC while avoiding choppy consolidation zones.
 * When it buys and sells: Buys when fast EMA crosses above slow EMA with supportive RSI and MACD, and sells on trailing ATR stop or EMA crossunder.
 * When it does not work: Suffers in prolonged sideways ranging markets with frequent whipsaws.
 */

function onUpdate(ctx) {
    if (ctx.i < 50) return null;

    const price = ctx.price;
    const pos = ctx.position;

    // Use 1h indicators
    const fastEma = ctx.ema(12, 0);
    const slowEma = ctx.ema(26, 0);
    const fastEmaPrev = ctx.ema(12, 1);
    const slowEmaPrev = ctx.ema(26, 1);
    const rsi = ctx.rsi(14, 0);
    const macdObj = ctx.macd(12, 26, 9, 0);
    const atr = ctx.atr(14, 0);

    if (fastEma == null || slowEma == null || fastEmaPrev == null || slowEmaPrev == null || rsi == null || macdObj == null || atr == null) {
        return null;
    }

    const macd = macdObj.macd;
    const signal = macdObj.signal;
    if (macd == null || signal == null) return null;

    // Display watch condition
    ctx.watch([
        { side: 'buy', price: price * 0.98, trigger: 'below', note: 'Pullback support', conds: [
            { label: 'RSI > 45', now: rsi, op: '>', ref: 45, closed: true },
            { label: 'MACD > Signal', ok: macd > signal }
        ]},
        { side: 'sell', price: price * 1.03, trigger: 'above', note: 'Trend Target' }
    ]);

    if (pos === 0) {
        // Entry condition: EMA Golden Cross + RSI > 50 + MACD bullish
        const goldenCross = (fastEmaPrev <= slowEmaPrev && fastEma > slowEma);
        const bullishMomentum = (rsi > 50 && macd > signal);

        if (goldenCross && bullishMomentum) {
            const qty = (ctx.cash / price) * 0.98;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Exit condition: EMA Death Cross or RSI drops below 40
        const deathCross = (fastEmaPrev >= slowEmaPrev && fastEma < slowEma);
        const bearMomentum = (rsi < 40);

        if (deathCross || bearMomentum) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
