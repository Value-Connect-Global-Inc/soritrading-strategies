/*
 * @coinsori-strategy v1
 * name: EmaPullbackRsiStrategy
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits pullbacks within strong trending markets identified by EMA alignment.
 * When it buys and sells: Buys when price dips below the short EMA while trend is up and RSI is oversold; sells on profit target or stop loss.
 * When it does not work: Suffers in choppy, range-bound markets with false breakouts.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    const pos = ctx.position;

    // Read indicators on closed bars
    const emaFast = ctx.ema(20, 1);
    const emaSlow = ctx.ema(50, 1);
    const rsi = ctx.rsi(14, 1);
    const atr = ctx.atr(14, 1);

    if (emaFast == null || emaSlow == null || rsi == null || atr == null) return null;

    const trendUp = emaFast > emaSlow;
    const oversold = rsi < 40;

    // Exit management if in position
    if (pos > 0) {
        const entryPx = ctx.entryPx || price;
        const stopPrice = entryPx - (2.0 * atr);
        const takeProfit = entryPx + (3.0 * atr);

        // Display watch conditions
        ctx.watch([
            { side: 'sell', price: takeProfit, trigger: 'above', note: 'Take Profit Target' },
            { side: 'sell', price: stopPrice, trigger: 'below', note: 'ATR Stop Loss' }
        ]);

        if (price <= stopPrice || price >= takeProfit) {
            return { side: 'sell', qty: pos };
        }
        return null;
    }

    // Entry logic
    const isDip = price <= emaFast;
    if (trendUp && isDip && oversold) {
        const qty = (ctx.cash * 0.99) / price;
        const stopPrice = price - (2.0 * atr);
        const takeProfit = price + (3.0 * atr);

        ctx.watch([
            { side: 'buy', price: price, trigger: 'below', note: 'EMA Pullback Entry',
              conds: [
                { label: 'Trend Up (EMA20 > EMA50)', ok: trendUp },
                { label: 'RSI < 40', now: rsi, op: '<', ref: 40, closed: true }
              ] },
            { side: 'sell', price: takeProfit, trigger: 'above', note: 'Take Profit' },
            { side: 'sell', price: stopPrice, trigger: 'below', note: 'Stop Loss' }
        ]);

        return { side: 'buy', qty: qty };
    }

    // Default watch when flat
    ctx.watch([
        { side: 'buy', price: emaFast, trigger: 'below', note: 'Waiting for EMA20 dip in uptrend',
          conds: [
            { label: 'Trend Up', ok: trendUp },
            { label: 'RSI oversold', now: rsi, op: '<', ref: 40, closed: true }
          ] }
    ]);

    return null;
}
