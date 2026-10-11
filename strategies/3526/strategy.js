/*
 * @coinsori-strategy v1
 * name: BTC Trend MA Crossover ATR Risk Managed 1h
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Captures sustained medium-term trends on 1-hour Bitcoin prices using moving average crossovers filtered by ATR volatility.
 * When it buys and sells: Buys when the fast moving average crosses above the slow moving average, and sells when it crosses below or hits a stop-loss.
 * When it does not work: Suffers during choppy, sideways, or highly ranging markets due to false crossover signals.
 */

function onUpdate(ctx) {
    const fast = ctx.sma(20, 1);
    const slow = ctx.sma(50, 1);
    const prevFast = ctx.sma(20, 2);
    const prevSlow = ctx.sma(50, 2);
    const atr = ctx.atr(14, 1);

    if (fast == null || slow == null || prevFast == null || prevSlow == null || atr == null) {
        return null;
    }

    const price = ctx.price;
    const position = ctx.position;

    // Golden cross: Fast SMA crosses above Slow SMA
    if (prevFast <= prevSlow && fast > slow && position <= 0) {
        // Size position using ATR volatility control
        const riskAmount = ctx.cash * 0.02; // risk 2% of cash
        const stopLossDist = atr * 2;
        const qty = Math.min(ctx.cash / price * 0.99, riskAmount / stopLossDist);
        if (qty > 0) {
            return { side: 'buy', qty: qty };
        }
    }

    // Death cross: Fast SMA crosses below Slow SMA
    if (prevFast >= prevSlow && fast < slow && position > 0) {
        return { side: 'sell', qty: position };
    }

    return null;
}
