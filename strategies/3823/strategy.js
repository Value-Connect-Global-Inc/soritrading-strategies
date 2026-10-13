/*
 * @coinsori-strategy v1
 * name: BtcFearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crowd sentiment mean-reversion. Extreme fear marks local bottoms, and after panic the recovery usually runs until the 50-day trend turns, so a panic buy held like a trend trade should profit from the rebound.
 * When it buys and sells: Buys on a day the Fear & Greed index is in extreme fear (<25). Sells when price drops below its 50-day average or a 2.5x ATR hard stop is hit. A 15-day cooldown after each exit prevents churn.
 * When it does NOT work: In a grinding bear market repeated panic buys can each be stopped out for small losses; in a powerful bull that never dips to extreme fear it rarely buys and lags the index.
 */

let lastExitBar = -1e9;

function onUpdate(ctx) {
  const pos = ctx.position;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  const fg = ctx.data('fear_greed');
  if (sma50 == null || atr == null || fg == null) return null;

  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : prevClose;
    const stop = entry - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 broken' },
      { side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' }
    ]);
    if (prevClose < sma50 || prevClose < stop) {
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
