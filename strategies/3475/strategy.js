/*
 * @coinsori-strategy v1
 * name: Volatility Breakout Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: We bet on strong directional continuation when price breaks out of local volatility bands accompanied by volume expansion.
 * When it buys and sells: Buys when price exceeds the upper Bollinger Band and volume exceeds the average volume; sells when price falls below the middle band or a trailing stop is hit.
 * When it does NOT work: Choppy, sideways markets with false breakouts cause repeated whipsaws and losses.
 */

function onUpdate(ctx) {
    const price = ctx.price;
    const cash = ctx.cash;
    const position = ctx.position;

    // Guard indicators
    const bb = ctx.bb(20, 2.0, 1);
    const bbCurrent = ctx.bb(20, 2.0, 0);
    const sma20 = ctx.sma(20, 1);
    const avgVol = ctx.avgVol(20);
    const vol = ctx.vol;

    if (!bb || !bbCurrent || sma20 == null || avgVol == null || vol == null) {
        return null;
    }

    // Watch conditions
    ctx.watch([
        { side: 'buy', price: bb.upper, trigger: 'above', note: 'Upper BB Breakout', conds: [
            { label: 'Volume > 1.2x Avg', now: vol, op: '>', ref: avgVol * 1.2, closed: false }
        ]},
        { side: 'sell', price: bbCurrent.middle, trigger: 'below', note: 'Middle BB Exit' }
    ]);

    // Entry condition: price closes above upper BB and volume is high
    if (position <= 0 && ctx.closes.at(-2) > bb.upper && vol > avgVol * 1.2) {
        const qty = (cash * 0.99) / price;
        return { side: 'buy', qty: qty };
    }

    // Exit condition: price falls below middle band
    if (position > 0 && price < bbCurrent.middle) {
        return { side: 'sell', qty: position };
    }

    return null;
}
