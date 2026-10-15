/*
 * @coinsori-strategy v1
 * name: Donchian Breakout Trend (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: strong trends start with a breakout above the recent range and
 * end with a breakdown below it. We follow the classic turtle recipe: buy a new
 * 20-day high, sell a new 10-day low, with a volatility-adaptive stop so no single
 * trade can hurt and the stop widens/narrows with market chop.
 * When it buys and sells: buys when the close makes a new 20-day high (the highest
 * close of the 20 bars BEFORE the signal bar, so the signal is confirmed on a closed
 * bar). Sells when the close makes a new 10-day low, or a 3×ATR hard stop is hit.
 * When it does NOT work: in a sideways chop the 20-day high/low whipsaws — you buy
 * the top of a small range and get stopped out repeatedly. That is the cost of
 * always being ready for the big trend.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  // volatility target: size so the position contributes ~2% daily vol to the pool
  let volScale = 1;
  if (prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  // 20-bar channel of CLOSED bars BEFORE the signal bar (ago 2..21 would include
  // the signal bar itself, so use ago 3..22). Confirmed signal on a closed bar.
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
    const stop = ctx.entryPx - 3 * atr;       // turtle-style: 3×ATR below entry, adapts to chop
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lowest) return { side: 'sell', qty: pos };   // new 10-day low = trend over
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '3xATR stop' },
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
