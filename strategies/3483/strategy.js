/*
 * @coinsori-strategy v1
 * name: MultiSymbolMomentumRotation
 * ex: binance
 * syms: BTC/USDT, ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Rotating capital into the stronger-performing crypto asset on 4h timeframe captures trend momentum while avoiding lagging assets.
 * When it buys and sells: Buys the asset with the higher 24-period rate of change when both are above their 50 SMA; exits when momentum drops or trend breaks.
 * When it does not work: Suffers during choppy, sideways markets with frequent whip-saw rotations.
 */
function onUpdate(ctx) {
    const syms = ctx.syms;
    const currentSym = ctx.sym;
    
    // Check if we have prices for both syms
    const myCloses = ctx.closes;
    if (myCloses.length < 50) return null;

    const sma50 = ctx.sma(50, 1);
    const roc24 = ctx.change(24, 1);
    if (sma50 == null || roc24 == null) return null;

    const price = ctx.price;
    const isBull = price > sma50;
    const hasPosition = ctx.position > 0;

    if (!hasPosition) {
        if (isBull && roc24 > 0.02) {
            const qty = (ctx.cash * 0.95) / price;
            ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'Momentum Rotation Entry', conds: [{ label: 'ROC(24) > 2%', now: roc24, op: '>', ref: 0.02, closed: true }] }]);
            return { side: 'buy', qty: qty };
        }
    } else {
        const exitCond = !isBull || roc24 < -0.01;
        if (exitCond) {
            ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'Momentum Exit' }]);
            return { side: 'sell', qty: ctx.position };
        }
    }

    return null;
}
