/*
 * @coinsori-strategy v1
 * name: Donchian Trend Breakout Wide Exit (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same classic 55-day close-high breakout as the champion,
 * but with a WIDER 30-day close-low exit instead of 20-day. The champion's
 * 2023-2026 window underperformed hold (+18.5% vs +53%) because the tighter
 * exit cut strong trends short. A wider exit should let winners run longer.
 * When it buys and sells: buys when the close makes a new 55-day high. Sells
 * when the close makes a new 30-day low, or a 30% hard stop is hit.
 * When it does NOT work: in choppy sideways markets the 55/30 breakout whipsaws;
 * in fast crashes the 30-day low exit lags even more than the 20-day, so the
 * hard stop takes a bigger hit before the exit fires.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null; // need 55 + 30 bars history

  const prevClose = closes[n - 2];

  // Highest close of the 55 closed bars before prevClose (excludes prevClose).
  let hi55 = -Infinity;
  for (let i = n - 2 - 55; i <= n - 3; i++) {
    if (closes[i] > hi55) hi55 = closes[i];
  }
  // Lowest close of the 30 closed bars before prevClose (excludes prevClose).
  let lo30 = Infinity;
  for (let i = n - 2 - 30; i <= n - 3; i++) {
    if (closes[i] < lo30) lo30 = closes[i];
  }

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.70; // hard stop 30% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lo30) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '30% stop' },
               { side: 'sell', price: lo30, trigger: 'below', note: 'exit: 30d low',
                 conds: [{ label: 'close vs 30d low', ok: prevClose >= lo30, closed: true }] }]);
    return null;
  }

  const breakout = prevClose > hi55;
  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'enter: 55d high',
               conds: [{ label: 'close vs 55d high', ok: breakout, closed: true }] }]);
  if (!breakout) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
