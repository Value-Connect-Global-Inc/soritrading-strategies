/*
 * @coinsori-strategy v1
 * name: MultiAsset Donchian Turtle 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Classic Donchian turtle trend-following — buy a fresh 55-day high,
 * ride the trend, exit on a 20-day low or a hard 2.5-ATR stop. A 200-day rising average
 * filter keeps it out of breakouts that fire into a downtrend, cutting the deep drawdowns
 * pure turtles suffer in bear regimes.
 * When it buys and sells: Buys each asset when the close makes a new 55-day high AND the
 * 200-day average is rising. Sells on a 20-day Donchian low break or a hard 2.5-ATR stop.
 * When it does NOT work: In a choppy sideways or ranging market the 55-day breakout is
 * immediately given back and the stop takes small losses repeatedly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (atr == null || atr <= 0 || sma200 == null || sma200prev == null) return null;
  if (ctx.closes.length < 60 || ctx.highs.length < 60 || ctx.lows.length < 60) return null;

  // Donchian 55 upper = highest high of the last 55 CLOSED bars (index -2 down to -56)
  let hi55 = 0;
  for (let i = 2; i <= 56; i++) {
    const h = ctx.highs.at(-i);
    if (h == null) return null;
    if (h > hi55) hi55 = h;
  }
  // Donchian 20 lower = lowest low of the last 20 CLOSED bars
  let lo20 = Infinity;
  for (let i = 2; i <= 21; i++) {
    const l = ctx.lows.at(-i);
    if (l == null) return null;
    if (l < lo20) lo20 = l;
  }

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

  if (price > hi55 && sma200 > sma200prev) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
