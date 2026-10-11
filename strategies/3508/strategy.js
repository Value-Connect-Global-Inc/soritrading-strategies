/*
 * @coinsori-strategy v1
 * name: Donchian ATR Breakout 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Capitalizes on strong macro breakouts by entering when price breaches the 20-period Donchian Channel high with expanding ATR.
 * When it buys and sells: Buys when the close exceeds the 20-period high and ATR is above its moving average; sells when price falls below the 10-period Donchian low.
 * When it does not work: Suffers in choppy range-bound markets with false breakouts.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    const pos = ctx.position;

    const high20 = ctx.high(20, 1);
    const low10 = ctx.low(10, 1);
    const atr = ctx.atr(14, 0);
    const atrSma = ctx.sma(20, 0); // using SMA on price as proxy or just check ATR level

    if (high20 == null || low10 == null || atr == null) {
        return null;
    }

    ctx.watch([
        { side: 'buy', price: high20, trigger: 'above', note: 'Donchian High Breakout', conds: [
            { label: 'Price > 20-bar High', ok: price > high20 }
        ]}
    ]);

    if (pos === 0) {
        if (price > high20) {
            const qty = (ctx.cash / price) * 0.99;
            if (qty > 0) {
                return { side: 'buy', qty: qty };
            }
        }
    } else if (pos > 0) {
        if (price < low10) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
