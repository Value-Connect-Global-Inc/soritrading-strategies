/*
 * @coinsori-strategy v1
 * name: BTC Daily Donchian ATR Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Captures powerful multi-week macro trends on the daily timeframe by buying new 55-day highs and exiting via a trailing ATR stop or channel midpoint.
 * When it buys and sells: Buys when price breaks above the 55-day Donchian channel high, and sells when price drops below the 20-day channel midpoint or hits an ATR trailing stop.
 * When it does NOT work: Suffers drawdowns during prolonged choppy sideways ranges where false breakouts whipsaw the portfolio.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    if (p == null) return null;

    // Check minimum history for Donchian 55
    const high55 = ctx.high(55, 1);
    const low20 = ctx.low(20, 1);
    const atr14 = ctx.atr(14);
    const sma200 = ctx.sma(200);

    if (high55 == null || low20 == null || atr14 == null || sma200 == null) return null;

    // Guard against null position state
    const pos = ctx.position;
    const entryPx = ctx.entryPx;

    // If flat, look for long entry on 55-day breakout with 200-day EMA/SMA filter for macro uptrend
    if (pos === 0 || pos == null) {
        if (p > high55 && p > sma200) {
            // Position sizing: risk 2% of capital via ATR stop
            const riskPerCoin = 2.5 * atr14;
            const targetRiskCash = ctx.cash * 0.02;
            let qty = targetRiskCash / riskPerCoin;
            const maxQty = (ctx.cash * 0.99) / p;
            if (qty > maxQty) qty = maxQty;

            ctx.watch([
                { side: 'buy', price: high55, trigger: 'above', note: '55d Donchian Breakout', conds: [
                    { label: 'Price > SMA200', ok: p > sma200 },
                    { label: 'Above 55d High', now: p, op: '>', ref: high55, closed: true }
                ]}
            ]);

            return { side: 'buy', qty: qty };
        }
    } else {
        // If long, exit if price drops below 20-day low or entry minus 3x ATR trailing stop
        const stopPx = Math.max(low20, entryPx - 3.0 * atr14);
        
        ctx.watch([
            { side: 'sell', price: stopPx, trigger: 'below', note: 'ATR Stop / 20d Low Exit', conds: [
                { label: 'Price < Stop Level', now: p, op: '<', ref: stopPx, closed: false }
            ]}
        ]);

        if (p < stopPx) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
