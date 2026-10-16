/*
 * @coinsori-strategy v1
 * name: BTC Donchian Wide-Exit 1D (champion baseline)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A 55-day Donchian breakout is a proven trend signal on BTC that has held
 * up on many disjoint windows (the existing champion). This is the pure, un-gated baseline:
 * buy every 55-day breakout, exit on the wide 55-day low breakdown or a 2x ATR stop. It is
 * the reference point every other variant this cycle is compared against.
 * When it buys and sells: buys when the daily close breaks above its 55-day high. Sells when
 * price closes below its 55-day low (wide exit) or falls to a 2x ATR stop from entry.
 * When it does NOT work: in a choppy sideways market the 55-day breakout buys false breakouts
 * and the wide exit gives back profit before triggering; it is long-only so it never profits
 * from a downtrend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 120) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l55 = Infinity;
  for (let k = 3; k <= 57; k++) l55 = Math.min(l55, c.at(-k));

  const prevClose = c.at(-2);
  const pos = ctx.position;

  // Exit first: 2x ATR hard stop or 55-day low breakdown
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l55) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l55, trigger: 'below', note: '55-bar low breakdown' }]);
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
