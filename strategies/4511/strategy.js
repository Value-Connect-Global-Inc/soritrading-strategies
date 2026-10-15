/*
 * @coinsori-strategy v1
 * name: Donchian Breakout Trend (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: strong trends start with a breakout above the recent range and
 * end with a breakdown below it. This is the exact turtle recipe that already works
 * on BTC 1D (strategy 4509) applied to ETH to test whether the edge generalizes to
 * another asset or was a BTC-only artifact.
 * When it buys and sells: buys when the close makes a new 20-day high (channel of the
 * 20 bars BEFORE the signal bar, so the signal is confirmed on a closed bar). Sells
 * when the close makes a new 10-day low, or a 20% hard stop is hit.
 * When it does NOT work: in a sideways chop the 20-day high/low whipsaws — you buy the
 * top of a small range and get stopped out repeatedly. That is the cost of always
 * being ready for the big trend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  // 20-bar channel of CLOSED bars BEFORE the signal bar (ago 3..22).
  let highest = -Infinity;
  for (let i = 3; i <= 22; i++) {
    const v = c.at(-i);
    if (v > highest) highest = v;
  }
  let lowest = Infinity;
  for (let i = 3; i <= 12; i++) {
    const v = c.at(-i);
    if (v < lowest) lowest = v;
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.80;          // hard stop: 20% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lowest) return { side: 'sell', qty: pos };   // new 10-day low = trend over
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: lowest, trigger: 'below', note: '10-day low break',
                 conds: [{ label: 'close above 10d low', ok: prevClose > lowest, closed: true }] }]);
    return null;
  }

  const breakout = prevClose > highest;
  ctx.watch([{ side: 'buy', price: highest, trigger: 'above', note: 'close makes new 20-day high',
               conds: [{ label: 'close > 20d high', ok: breakout, closed: true }] }]);
  if (!breakout) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
