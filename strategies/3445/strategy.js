/*
 * @coinsori-strategy v1
 * name: BTC Bollinger Mean Reversion 1h
 * ex: binance
 * syms: BTCUSDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits short-term overextensions in BTC 1h by buying when price dips below the lower Bollinger Band with oversold RSI and selling near the middle band.
 * When it buys and sells: Buys when RSI(14) < 30 and price touches or drops below the lower Bollinger Band (20, 2.0); sells when price crosses above the middle SMA band or RSI exceeds 55.
 * When it does not work: Suffers during strong secular trends where price hugs the lower band and keeps falling.
 */

function onUpdate(ctx) {
    const closes = ctx.closes;
    if (closes.length < 50) return null;

    const price = ctx.price;
    const pos = ctx.position;
    const cash = ctx.cash;

    const bb = ctx.bb(20, 2.0);
    const rsi = ctx.rsi(14);
    if (bb == null || rsi == null) return null;

    const prevClose = closes.at(-2);
    const prevBb = ctx.bb(20, 2.0, 1);
    const prevRsi = ctx.rsi(14, 1);
    if (prevBb == null || prevRsi == null) return null;

    ctx.watch([
        { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB Lower Touch', conds: [
            { label: 'RSI(14) < 35', now: rsi, op: '<', ref: 35, closed: true }
        ]},
        { side: 'sell', price: bb.middle, trigger: 'above', note: 'BB Middle Target' }
    ]);

    if (pos <= 0) {
        // Buy condition: oversold bounce off lower Bollinger band
        if (prevClose <= prevBb.lower && price > bb.lower && rsi < 35) {
            const qty = (cash / price) * 0.99;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Sell condition: price reaches middle band or overbought RSI
        if (price >= bb.middle || rsi > 60) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
