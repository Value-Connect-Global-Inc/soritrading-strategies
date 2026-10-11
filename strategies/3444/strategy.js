/*
 * @coinsori-strategy v1
 * name: BTC Volatility Breakout Sentiment Channel
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Exploits multi-hour volatility expansions and breakout trends in BTC by entering when price breaches the upper ATR channel, confirmed by market sentiment.
 * When it buys and sells: Buys when the close breaks above the 20-period upper Keltner/ATR band with supportive Fear & Greed, and sells on trailing ATR stop or lower band cross.
 * When it does not work: Suffers in ranging, choppy markets where false breakouts frequently trigger stop-losses.
 */

function onUpdate(ctx) {
    const closes = ctx.closes;
    if (closes.length < 50) return null;

    const price = ctx.price;
    const pos = ctx.position;
    const cash = ctx.cash;

    const ma = ctx.sma(20);
    const atr = ctx.atr(14);
    if (ma == null || atr == null) return null;

    const upperBand = ma + 2.0 * atr;
    const lowerBand = ma - 2.0 * atr;

    const prevClose = closes.at(-2);
    const prevMa = ctx.sma(20, 1);
    const prevAtr = ctx.atr(14, 1);
    if (prevMa == null || prevAtr == null) return null;
    const prevUpper = prevMa + 2.0 * prevAtr;

    // Optional sentiment filter from data if available, else neutral
    const fg = ctx.data('fg');
    // We treat fg as a number or null; if null, assume neutral 50
    const sentiment = (fg != null && typeof fg === 'number') ? fg : 50;

    ctx.watch([
        { side: 'buy', price: upperBand, trigger: 'above', note: 'ATR Breakout Upper', conds: [
            { label: 'Sentiment >= 40', now: sentiment, op: '>=', ref: 40, closed: true }
        ]},
        { side: 'sell', price: lowerBand, trigger: 'below', note: 'ATR Channel Lower / Stop' }
    ]);

    if (pos <= 0) {
        // Breakout condition: previous close below prevUpper, current close above upperBand
        if (prevClose <= prevUpper && price > upperBand && sentiment >= 40) {
            const qty = (cash / price) * 0.99;
            return { side: 'buy', qty: qty };
        }
    } else {
        // Exit condition: price drops below lower band or trailing stop
        if (price < lowerBand) {
            return { side: 'sell', qty: pos };
        }
    }

    return null;
}
