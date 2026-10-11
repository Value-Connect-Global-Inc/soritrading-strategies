/*
 * @coinsori-strategy v1
 * name: ETH 4h MTF Trend Continuation
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH trends strongly on higher timeframes; catching pullbacks within the daily trend direction avoids buying local tops.
 * When it buys and sells: Buys when 4h EMA20 > EMA50 and price crosses back above EMA20 after a pullback; sells on ATR trailing stop or EMA breakdown.
 * When it does NOT work: Choppy, range-bound markets where daily trend whipsaws and 4h pullbacks lead to immediate reversals.
 */

function onUpdate(ctx) {
    const closes = ctx.closes;
    if (closes == null || closes.length < 60) return null;

    const ema20 = ctx.ema(20, 1);
    const ema50 = ctx.ema(50, 1);
    const prevEma20 = ctx.ema(20, 2);
    const prevEma50 = ctx.ema(50, 2);
    const atr14 = ctx.atr(14, 1);
    const curPrice = ctx.price;
    const pos = ctx.position;

    if (ema20 == null || ema50 == null || prevEma20 == null || prevEma50 == null || atr14 == null) return null;

    const prevClose = closes.at(-2);
    const prevPrevClose = closes.at(-3);
    if (prevClose == null || prevPrevClose == null) return null;

    // Strict trend confirmation: EMA20 > EMA50 and rising
    const uptrend = ema20 > ema50 && ema20 > prevEma20;
    
    // Crossover confirmation: price was below or at EMA20 two bars ago, now above
    const crossAboveEma = prevPrevClose <= prevEma20 && prevClose > ema20;

    ctx.watch([
        { side: 'buy', price: ema20, trigger: 'above', note: 'EMA20 cross-up continuation', conds: [
            { label: 'Uptrend (EMA20 > EMA50 & rising)', ok: uptrend },
            { label: 'Crossed above EMA20', now: prevClose, op: '>', ref: ema20, closed: true }
        ]}
    ]);

    if (pos <= 0) {
        if (uptrend && crossAboveEma) {
            const riskAmt = ctx.cash * 0.99;
            const qty = riskAmt / curPrice;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Exit if trend reverses or price drops below EMA50
        const exitSignal = prevClose < ema50 || prevClose < ema20 - (2.0 * atr14);
        if (exitSignal) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
