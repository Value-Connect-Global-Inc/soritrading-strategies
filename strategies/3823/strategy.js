/*
 * @coinsori-strategy v1
 * name: BtcFearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crowd sentiment mean-reversion. Extreme fear marks local bottoms and extreme greed marks local tops in BTC, so buying panic and selling euphoria should beat blindly holding through both.
 * When it buys and sells: Buys on a day the Fear & Greed index is in extreme fear (<25). Sells when sentiment hits extreme greed (>75) or a 2.5x ATR hard stop is hit. A 15-day cooldown after each exit prevents churn.
 * When it does NOT work: In a grinding bear market fear keeps recurring and each buy can be stopped out for a small loss repeatedly; and because it only buys at fear, it misses calm steady rallies.
 */

let lastExitBar = -1e9;

function onUpdate(ctx) {
  const pos = ctx.position;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  const fg = ctx.data('fear_greed');
  if (atr == null || fg == null) return null;

  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : prevClose;
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' }]);
    if (fg > 75 || prevClose < stop) {
      lastExitBar = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // No price level — pure sentiment signal, so no watch() on the buy side.
  if (fg < 25 && (ctx.i - lastExitBar > 15)) {
    const stopDist = Math.max(2.5 * atr, prevClose * 0.03);
    const qty = (0.02 * ctx.cash) / stopDist;
    const maxQty = (ctx.cash / prevClose) * 0.98;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
