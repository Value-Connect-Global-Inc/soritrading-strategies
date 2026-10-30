/*
 * @coinsori-strategy v1
 * name: MultiAsset Donchian Turtle 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Classic Donchian turtle trend-following — buy a fresh 55-day high,
 * ride the trend, exit on a 20-day low or a hard 2.5-ATR stop. This is the complement to
 * the mean-reversion basket: it profits from the sustained melt-ups that a dip-buyer caps.
 * When it buys and sells: Buys each asset when the close makes a new 55-day high. Sells on
 * a 20-day Donchian low break or a hard 2.5-ATR stop from entry.
 * When it does NOT work: In a choppy sideways or ranging market the 55-day breakout is
 * immediately given back and the stop takes small losses repeatedly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const hi55 = ctx.high(55, 1);   // highest high of last 55 closed bars = Donchian upper
  const lo20 = ctx.low(20, 1);    // lowest low of last 20 closed bars = Donchian lower
  if (atr == null || atr <= 0 || hi55 == null || lo20 == null) return null;

  const pos = ctx.pos(ctx.sym);
  const entry = ctx.entryPx;
  if (pos > 0) {
    const stop = entry != null && entry > 0 ? entry - 2.5 * atr : null;
    const watchList = [{ side: 'sell', price: lo20, trigger: 'below', note: 'Donchian 20 exit' }];
    if (stop != null) watchList.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard 2.5 ATR stop' });
    ctx.watch(watchList);
    if (stop != null && price < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price < lo20) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (price > hi55) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
