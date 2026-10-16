/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Donchian (channel) breakout is the strongest family tested on BTC 1d in this
 * ledger — it captures sustained trends and cuts losses with a hard stop, on standard Turtle
 * defaults with no parameter tuning.
 * When it buys and sells: buys when a closed daily bar breaks the 55-bar high. Sells on a 2x ATR
 * hard stop or when a closed bar breaks the 20-bar low.
 * When it does NOT work: in choppy sideways markets the 55-bar breakout whipsaws repeatedly. In a
 * long bear market it stays mostly in cash then re-enters late on the recovery, giving back part of
 * the bounce. Drawdowns can still reach ~30-40% in big trend reversals.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 100) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));

  const NB = c.length - 2;
  const prevClose = c.at(-2);
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  if (!(prevClose > h55)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);
    return null;
  }

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);
  return { side: 'buy', qty };
}
