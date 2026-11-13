/*
 * @coinsori-strategy v1
 * name: SMA200 Regime 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto trends are long and persistent, so being long only
 * while price is clearly above its long-term average captures most of the upside
 * and steps aside during major downtrends.
 * When it buys and sells: it buys when the 4h close is 3% above its 200-bar
 * average; it sells when the close falls 3% below the average OR price drops 6xATR
 * below the best high since entry (protects against fast crashes).
 * When it does NOT work: in a sideways chop inside the band it stays flat and
 * misses short swings, and it lags fast moves because the 200-bar average is slow.
 */

function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;

  if (pos > 0) {
    const sma200 = ctx.sma(200, 1);
    if (sma200 == null) { ctx.watch([]); return null; }
    const prevClose = ctx.closes.at(-2);
    const atrNow = ctx.atr(14, 1);
    const hh = ctx.state.hh != null ? Math.max(ctx.state.hh, price) : price;
    ctx.state.hh = hh;
    const chand = atrNow != null ? hh - 6 * atrNow : price * 0.9;
    const exitPx = Math.max(sma200 * 0.97, chand);
    ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'Regime/chandelier exit' }]);
    if (prevClose != null && prevClose <= exitPx) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.closes.length < 220) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) { ctx.watch([]); return null; }
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }
  if (prevClose > sma200 * 1.03) {
    ctx.state.hh = price;
    ctx.watch([{ side: 'buy', price: sma200 * 1.03, trigger: 'above', note: 'Regime up' }]);
    const qty = (ctx.cash / price) * 0.99;
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: sma200 * 1.03, trigger: 'above', note: 'Regime up' }]);
  return null;
}
