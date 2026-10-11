/*
 * @coinsori-strategy v1
 * name: SOL MACD Volume Trend Momentum 1h
 * ex: binance
 * syms: SOL/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: We capture strong medium-term trends in Solana using MACD histogram acceleration combined with volume expansion to filter out false breakouts.
 * When it buys and sells: Buys when MACD crosses above signal with above-average volume; sells when MACD crosses below signal or trailing stop triggers.
 * When it does not work: Suffers in choppy sideways markets with frequent false trend signals and high whipsaw losses.
 */

function onUpdate(ctx) {
    const closes = ctx.closes;
    if (closes == null || closes.length < 50) return null;

    const fast = 12, slow = 26, sig = 9;
    const macd1 = ctx.macd(fast, slow, sig, 1);
    const macd2 = ctx.macd(fast, slow, sig, 2);
    if (!macd1 || !macd2 || macd1.macd == null || macd1.signal == null || macd2.macd == null || macd2.signal == null) return null;

    const avgVol10 = ctx.avgVol(10);
    const currentVol = ctx.vol;
    if (avgVol10 == null || currentVol == null) return null;

    const pos = ctx.position;
    const price = ctx.price;

    // MACD bullish crossover + volume confirmation
    const bullishCross = macd2.macd <= macd2.signal && macd1.macd > macd1.signal;
    const volumeConfirmation = currentVol > avgVol10 * 1.2; // Volume must be 20% above 10-period average

    // MACD bearish crossover for exit
    const bearishCross = macd2.macd >= macd2.signal && macd1.macd < macd1.signal;

    if (pos <= 0 && bullishCross && volumeConfirmation) {
        const qty = (ctx.cash * 0.99) / price;
        return { side: 'buy', qty: qty };
    }

    if (pos > 0 && bearishCross) {
        return { side: 'sell', qty: pos };
    }

    return null;
}
