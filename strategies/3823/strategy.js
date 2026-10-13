/*
 * @coinsori-strategy v1
 * name: BtcFearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Regime-switched sentiment. In an uptrend the crowd's fear marks buyable dips (buy fear, ride the trend); in a downtrend only panic buying works because relief rallies are the only upside (buy panic, sell the relief).
 * When it buys and sells: Above the 200-day average it buys any day Fear & Greed is below 50 and sells when price breaks its 50-day average. Below the 200-day average it buys only extreme fear (<25) and sells at extreme greed (>75). Every position has a 2.5x ATR hard stop and a 15-day cooldown after exits.
 * When it does NOT work: In a prolonged bear market repeated panic buys can each be stopped out for small losses; in a powerful bull that never dips below 50 greed it waits for a pullback and lags the index.
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

  const uptrend = prevClose > sma200;

  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : prevClose;
    const stop = entry - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 broken' },
      { side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' }
    ]);
    // Greed exit only applies to positions bought as panic-bottom-fishing (downtrend mode)
    if (prevClose < sma50 || prevClose < stop || (!uptrend && fg > 75)) {
      lastExitBar = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (ctx.i - lastExitBar <= 15) return null;

  if (uptrend) {
    // Uptrend: buy the dip, but not when the crowd is already greedy
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Uptrend dip', conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 50 }] }]);
    if (fg < 50) {
      const stopDist = Math.max(2.5 * atr, prevClose * 0.03);
      const qty = (0.02 * ctx.cash) / stopDist;
      const maxQty = (ctx.cash / prevClose) * 0.98;
      return { side: 'buy', qty: Math.min(qty, maxQty) };
    }
    return null;
  }

  // Downtrend: only buy panic, sell the relief rally
  if (fg < 25) {
    const stopDist = Math.max(2.5 * atr, prevClose * 0.03);
    const qty = (0.02 * ctx.cash) / stopDist;
    const maxQty = (ctx.cash / prevClose) * 0.98;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
