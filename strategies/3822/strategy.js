/*
 * @coinsori-strategy v1
 * name: BtcPlainTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A/B control for BtcFedRegime. Pure 200/50 day moving-average trend with a cooldown, no fed-funds filter. Used to isolate whether the monetary-regime gate adds or removes value.
 * When it buys and sells: Buys when price is above its 200-day average (15-day cooldown after exits). Sells when price drops below its 50-day average or a 2x ATR hard stop is hit.
 * When it does NOT work: Whipsaws in choppy markets; holds through bear markets until the 50-day break.
 */

let lastExitBar = -1e9;

function onUpdate(ctx) {
  const pos = ctx.position;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma50 == null || atr == null) return null;

  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : prevClose;
    const stop = entry - 2 * atr;
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 broken' },
      { side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' }
    ]);
    if (prevClose < sma50 || prevClose < stop) {
      lastExitBar = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 reclaim' }]);
  if (prevClose > sma200 && (ctx.i - lastExitBar > 15)) {
    const stopDist = Math.max(2 * atr, prevClose * 0.02);
    const qty = (0.02 * ctx.cash) / stopDist;
    const maxQty = (ctx.cash / prevClose) * 0.98;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
