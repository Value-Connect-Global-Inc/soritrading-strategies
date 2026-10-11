/*
 * @coinsori-strategy v1
 * name: CleanEmaTrend4h
 * ex: binance
 * syms: BTC/USDT, BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Pure price-action trend following using exponential moving averages and ATR volatility confirmation to avoid whipsaws.
 * When it buys and sells: Buys when fast EMA crosses above slow EMA during expanding ATR volatility; sells when fast EMA crosses below slow EMA or price drops below stop loss.
 * When it does not work: Suffers in choppy, range-bound markets with frequent false breakouts.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    const ema20 = ctx.ema(20, 1);
    const ema20_prev = ctx.ema(20, 2);
    const ema50 = ctx.ema(50, 1);
    const ema50_prev = ctx.ema(50, 2);
    const atr = ctx.atr(14, 1);

    if (ema20 == null || ema20_prev == null || ema50 == null || ema50_prev == null || atr == null) {
        return null;
    }

    const pos = ctx.position;
    const cash = ctx.cash;

    // Golden cross of EMA20 over EMA50
    const crossUp = (ema20_prev <= ema50_prev && ema20 > ema50);
    // Death cross
    const crossDown = (ema20_prev >= ema50_prev && ema20 < ema50);

    if (pos <= 0 && crossUp) {
        ctx.watch([
            { side: 'buy', price: p, trigger: 'above', note: 'EMA 20/50 Golden Cross', conds: [
                { label: 'EMA20 > EMA50', ok: true }
            ]}
        ]);
        return { side: 'buy', qty: (cash / p) * 0.99 };
    }

    if (pos > 0 && crossDown) {
        ctx.watch([
            { side: 'sell', price: p, trigger: 'below', note: 'EMA 20/50 Death Cross', conds: [
                { label: 'EMA20 < EMA50', ok: true }
            ]}
        ]);
        return { side: 'sell', qty: pos };
    }

    ctx.watch([
        { side: 'buy', price: ema50, trigger: 'below', note: 'Waiting for EMA50 support' }
    ]);
    return null;
}
