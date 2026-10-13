/*
 * @coinsori-strategy v1
 * name: BtcFearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crowd sentiment mean-reversion. Extreme fear marks local bottoms and extreme greed marks local tops in BTC, so buying panic and selling euphoria should beat blindly holding through both.
 * When it buys and sells: Buys when the Fear & Greed index is in extreme fear (<25) while price is still above its 200-day average (only trade the uptrend). Sells when sentiment hits extreme greed (>75), price drops below its 50-day average, or a 2x ATR hard stop is hit — whichever comes first.
 * When it does NOT work: In long grinding bear markets price stays below the 200-day average so it rarely buys (good defence but it misses the bottom); in choppy sideways markets the fear/greed swings trigger small whipsaw trades.
 */

let lastExitBar = -1e9;

function onUpdate(ctx) {
  const pos = ctx.position;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  const fg = ctx.data('fear_greed');
  if (sma200 == null || sma50 == null || atr == null || fg == null) return null;

  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : prevClose;
    const stop = entry - 2 * atr;
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 broken' },
      { side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
      { side: 'sell', price: 75, trigger: 'above', note: 'Extreme greed', conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 75 }] }
    ]);
    if (prevClose < sma50 || prevClose < stop || fg > 75) {
      lastExitBar = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Buy only deep panic while the long-term trend is still up
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim', conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 25 }] }]);
  if (prevClose > sma200 && fg < 25 && (ctx.i - lastExitBar > 15)) {
    const stopDist = Math.max(2 * atr, prevClose * 0.02);
    const qty = (0.02 * ctx.cash) / stopDist;
    const maxQty = (ctx.cash / prevClose) * 0.98;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
