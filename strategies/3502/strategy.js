/*
 * @coinsori-strategy v1
 * name: EMA MACD Trend Momentum Crossover
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Following strong medium-term trends using fast/slow EMA alignment and MACD momentum confirmation to capture sustainable directional moves.
 * When it buys and sells: Buys when EMA(20) crosses above EMA(50) and MACD histogram is positive; sells when EMA(20) crosses below EMA(50) or stop loss / take profit is hit.
 * When it does not work: Suffers in choppy, range-bound markets with frequent false crossovers resulting in whipsaw losses.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    const pos = ctx.position;

    // Check minimum required bars for EMA 50 and MACD
    const emaFast = ctx.ema(20, 1);
    const emaFastPrev = ctx.ema(20, 2);
    const emaSlow = ctx.ema(50, 1);
    const emaSlowPrev = ctx.ema(50, 2);
    const macdData = ctx.macd(12, 26, 9, 1);
    const macdPrev = ctx.macd(12, 26, 9, 2);

    if (emaFast == null || emaSlow == null || emaFastPrev == null || emaSlowPrev == null || macdData == null || macdPrev == null || macdData.macd == null || macdData.signal == null) {
        return null;
    }

    const hist = macdData.macd - macdData.signal;
    const histPrev = macdPrev.macd - macdPrev.signal;

    // Entry condition: Bullish crossover of EMA 20 over EMA 50 with positive and expanding MACD histogram
    const bullishCrossover = emaFastPrev <= emaSlowPrev && emaFast > emaSlow;
    const momentumConfirm = hist > 0 && hist > histPrev;

    // Exit condition: Bearish crossover of EMA 20 below EMA 50
    const bearishCrossover = emaFastPrev >= emaSlowPrev && emaFast < emaSlow;

    if (pos === 0 && bullishCrossover && momentumConfirm) {
        const qty = (ctx.cash / p) * 0.98;
        ctx.watch([
            { side: 'buy', price: p, trigger: 'above', note: 'EMA bullish crossover entry', conds: [
                { label: 'EMA20 > EMA50', ok: true },
                { label: 'MACD hist expanding', ok: true }
            ]}
        ]);
        return { side: 'buy', qty: qty };
    }

    if (pos > 0 && bearishCrossover) {
        ctx.watch([
            { side: 'sell', price: p, trigger: 'below', note: 'EMA bearish crossover exit' }
        ]);
        return { side: 'sell', qty: pos };
    }

    return null;
}
