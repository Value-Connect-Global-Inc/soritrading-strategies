/*
 * @coinsori-strategy v1
 * name: Multi-Timeframe Trend Breakout
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Filters hourly noise by requiring alignment with longer-term momentum and trades wider breakouts to avoid whipsaws.
 * When it buys and sells: Buys when price breaks the 50-period high while RSI confirms upward momentum; sells on trailing stop or RSI breakdown.
 * When it does not work: Suffers in prolonged range-bound or choppy sideways markets where breakouts immediately reverse.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    const pos = ctx.position;

    // We need at least 50 bars for SMA and high/low channels
    const sma50 = ctx.sma(50, 1);
    const rsi = ctx.rsi(14, 1);
    const high50 = ctx.high(50, 1);
    const low50 = ctx.low(50, 1);

    if (sma50 == null || rsi == null || high50 == null || low50 == null) {
        return null;
    }

    // Long entry: Price breaks above the 50-bar high, price is above 50 SMA, and RSI is bullish (> 50)
    if (pos <= 0 && price > high50 && price > sma50 && rsi > 50) {
        const qty = (ctx.cash / price) * 0.99;
        ctx.watch([
            { side: 'buy', price: high50, trigger: 'above', note: 'Breakout high', conds: [
                { label: 'Price > SMA50', ok: price > sma50 },
                { label: 'RSI > 50', now: rsi, op: '>', ref: 50, closed: true }
            ]}
        ]);
        return { side: 'buy', qty: qty };
    }

    // Exit: Price falls below the 50-bar low or RSI drops below 45
    if (pos > 0 && (price < low50 || rsi < 45)) {
        ctx.watch([
            { side: 'sell', price: low50, trigger: 'below', note: 'Channel low exit', conds: [
                { label: 'RSI < 45', now: rsi, op: '<', ref: 45, closed: true }
            ]}
        ]);
        return { side: 'sell', qty: pos };
    }

    ctx.watch([
        { side: 'buy', price: high50, trigger: 'above', note: 'Waiting for breakout' }
    ]);
    return null;
}
