/*
 * @coinsori-strategy v1
 * name: OnChain Active Address Trend Strategy
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On-chain network activity (active addresses) often leads or confirms fundamental demand shifts in Bitcoin, helping filter out false price breakouts.
 * When it buys and sells: Buys when active address moving average is rising and price crosses above its short-term moving average; sells when active address trend rolls over or price breaks below support.
 * When it does not work: During sudden macro shocks or decoupling of on-chain activity from price action, leading to whipsaws.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    if (p == null) return null;

    // Read active address dataset
    const addr = ctx.data('addr');
    const addrSma = ctx.data('addr_sma30');
    if (addr == null || addrSma == null) return null;

    // Technical indicators
    const sma50 = ctx.sma(50);
    const sma200 = ctx.sma(200);
    const rsi = ctx.rsi(14);
    if (sma50 == null || sma200 == null || rsi == null) return null;

    const pos = ctx.position;

    // Conditions: Active addresses trending up AND price above SMA50 AND RSI not overbought
    const addrGrowing = addr > addrSma;
    const bullishTrend = p > sma50 && sma50 > sma200;

    ctx.watch([
        { side: 'buy', price: sma50, trigger: 'above', note: 'SMA50 breakout with active addresses', conds: [
            { label: 'Addr > AddrSma30', ok: addrGrowing },
            { label: 'Bullish Trend', ok: bullishTrend },
            { label: 'RSI < 70', now: rsi, op: '<', ref: 70, closed: true }
        ]}
    ]);

    if (pos <= 0 && addrGrowing && bullishTrend && p > sma50 && rsi < 70) {
        const qty = (ctx.cash / p) * 0.99;
        return { side: 'buy', qty };
    }

    // Exit if active address trend fails or price drops below SMA50
    if (pos > 0 && (!addrGrowing || p < sma50)) {
        return { side: 'sell', qty: pos };
    }

    return null;
}
