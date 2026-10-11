/*
 * @coinsori-strategy v1
 * name: Simple SMA Crossover Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures medium-term trend direction using fast and slow Simple Moving Averages with an RSI filter.
 * When it buys and sells: Buys when SMA(20) crosses above SMA(50) and RSI > 50; sells when SMA(20) crosses below SMA(50) or RSI < 45.
 * When it does NOT work: Suffers in ranging markets with frequent whipsaws around crossover points.
 */

function onUpdate(ctx) {
    const s1 = ctx.sma(20, 1);
    const s2 = ctx.sma(50, 1);
    const p1 = ctx.sma(20, 2);
    const p2 = ctx.sma(50, 2);
    const rsi = ctx.rsi(14, 1);
    if (s1 == null || s2 == null || p1 == null || p2 == null || rsi == null) return null;

    const price = ctx.price;
    const pos = ctx.position;

    ctx.watch([
        { side: 'buy', price: price, trigger: 'above', note: 'SMA Crossover & RSI > 50', conds: [
            { label: 'RSI(14)', now: rsi, op: '>', ref: 50, closed: true }
        ]},
        { side: 'sell', price: price, trigger: 'below', note: 'SMA Crossover Bearish' }
    ]);

    if (pos <= 0 && p1 <= p2 && s1 > s2 && rsi > 50) {
        return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
    }

    if (pos > 0 && ( (p1 >= p2 && s1 < s2) || rsi < 45 )) {
        return { side: 'sell', qty: pos };
    }

    return null;
}
