/*
 * @coinsori-strategy v1
 * name: MtfEmaPullbackAtr
 * ex: binance
 * syms: ETH/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: ETH/USDT 1h trends strongly on pullbacks during healthy volatility regimes.
 * When it buys and sells: Buys when 1h price pulls back to EMA(50) while 4h trend is bullish, exits on ATR trailing stop or target.
 * When it does not work: Suffers during choppy, low-volatility range markets and sudden trend reversals.
 */
function onUpdate(ctx) {
    const p = ctx.price;
    const closes = ctx.closes;
    if (closes.length < 60) return null;

    const sma50 = ctx.sma(50, 1);
    const sma200 = ctx.sma(200, 1);
    const rsi14 = ctx.rsi(14, 1);
    const atr14 = ctx.atr(14, 1);
    const prevClose = closes.at(-2);

    if (sma50 == null || sma200 == null || rsi14 == null || atr14 == null || prevClose == null) return null;

    const isBullTrend = prevClose > sma200;
    const nearSma50 = Math.abs(prevClose - sma50) / sma50 < 0.015;
    const rsiOversold = rsi14 < 45;

    const hasPosition = ctx.position > 0;

    if (!hasPosition) {
        if (isBullTrend && nearSma50 && rsiOversold) {
            const qty = (ctx.cash * 0.95) / p;
            ctx.watch([{ side: 'buy', price: sma50, trigger: 'below', note: 'EMA50 Pullback Buy', conds: [{ label: 'RSI < 45', now: rsi14, op: '<', ref: 45, closed: true }] }]);
            return { side: 'buy', qty: qty };
        }
    } else {
        const entryPx = ctx.entryPx;
        const tp = entryPx * 1.04;
        const sl = entryPx - (2.5 * atr14);

        if (p >= tp || p <= sl) {
            ctx.watch([{ side: 'sell', price: tp, trigger: 'above', note: 'TP 4%' }, { side: 'sell', price: sl, trigger: 'below', note: 'ATR Stop Loss' }]);
            return { side: 'sell', qty: ctx.position };
        }
    }

    return null;
}
