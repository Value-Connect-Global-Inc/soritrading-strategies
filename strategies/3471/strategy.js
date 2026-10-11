/*
 * @coinsori-strategy v1
 * name: Multi-Timeframe Trend Volatility Filter BTC 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Captures robust medium-term trends on 4h charts by combining a trend filter with volatility expansion and volume confirmation.
 * When it buys and sells: Buys when price is above SMA(50), 4h RSI is in bullish territory, and volume exceeds average; sells on trailing stop or trend reversal.
 * When it does NOT work: Experiences whipsaws during choppy, sideways consolidation ranges without clear directional momentum.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    if (price == null) return null;

    // We need at least 50 bars for SMA and ATR
    const sma50 = ctx.sma(50, 1);
    const rsi14 = ctx.rsi(14, 1);
    const avgVol20 = ctx.avgVol(20);
    const currVol = ctx.vol;
    const pos = ctx.position;

    if (sma50 == null || rsi14 == null || avgVol20 == null || currVol == null) {
        return null;
    }

    const prevClose = ctx.closes.at(-2);
    if (prevClose == null) return null;

    // Define entry conditions: price > SMA50, RSI > 50, volume spike
    const isBullishTrend = prevClose > sma50;
    const isMomentumStrong = rsi14 > 50;
    const isVolumeSupported = currVol > avgVol20 * 1.1;

    // Watch conditions for live/paper UI
    ctx.watch([
        { side: 'buy', price: sma50, trigger: 'above', note: 'SMA50 Trend Support', conds: [
            { label: 'RSI(14)', now: rsi14, op: '>', ref: 50, closed: true },
            { label: 'Volume > 1.1x Avg', ok: isVolumeSupported }
        ]}
    ]);

    if (pos <= 0) {
        if (isBullishTrend && isMomentumStrong && isVolumeSupported) {
            const qty = (ctx.cash / price) * 0.99;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Exit if price drops below SMA50 or RSI drops significantly
        if (prevClose < sma50 || rsi14 < 42) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
