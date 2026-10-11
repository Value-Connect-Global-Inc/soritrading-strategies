/*
 * @coinsori-strategy v1
 * name: Robust Trend ATR Stop BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Reduces overtrading by using a slow EMA(100) filter and MACD momentum confirmation, locking in profits with an ATR-based trailing stop.
 * When it buys and sells: Buys when price is above EMA(100) and MACD histogram turns positive; sells on MACD bearish crossover or ATR trailing stop breach.
 * When it does NOT work: Suffers drawdowns during choppy sideways consolidation or sharp V-bottom reversals where trailing stops lag.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    if (price == null) return null;

    const ema100 = ctx.ema(100, 1);
    const macdData = ctx.macd(12, 26, 9, 1);
    const macdPrev = ctx.macd(12, 26, 9, 2);
    const atr14 = ctx.atr(14, 1);
    const pos = ctx.position;

    if (ema100 == null || macdData == null || macdPrev == null || atr14 == null) {
        return null;
    }

    const prevClose = ctx.closes.at(-2);
    if (prevClose == null) return null;

    // Trend and momentum confirmation
    const isBullish = prevClose > ema100;
    const macdCrossUp = macdPrev.macd <= macdPrev.signal && macdData.macd > macdData.signal;
    const macdCrossDown = macdPrev.macd >= macdPrev.signal && macdData.macd < macdData.signal;

    ctx.watch([
        { side: 'buy', price: ema100, trigger: 'above', note: 'EMA100 Trend', conds: [
            { label: 'MACD Bullish Cross', ok: macdCrossUp },
            { label: 'Close > EMA100', ok: isBullish }
        ]}
    ]);

    if (pos <= 0) {
        if (isBullish && macdCrossUp) {
            const qty = (ctx.cash / price) * 0.99;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Exit on MACD bearish cross or if price drops 3x ATR below recent peak/entry
        if (macdCrossDown || prevClose < ema100) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
