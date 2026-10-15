/*
 * @coinsori-strategy v1
 * name: Champion Baseline (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated champion — full-size Donchian 55/20 close
 * breakout on BTC/ETH 1D. Kept verbatim from strategy 4525 to get an exact
 * apples-to-apples baseline on the same windows as the ATR variants.
 * When it buys and sells: buys when the close makes a new 55-day high. Sells
 * when the close makes a new 20-day low, or a 30% hard stop is hit.
 * When it does NOT work: in choppy sideways markets the 55/20 breakout whipsaws
 * repeatedly; in fast crashes the 20-day low exit lags and the stop takes a big
 * hit before the exit fires.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes[n - 2];

  let hi55 = -Infinity;
  for (let i = n - 2 - 55; i <= n - 3; i++) {
    if (closes[i] > hi55) hi55 = closes[i];
  }
  let lo20 = Infinity;
  for (let i = n - 2 - 20; i <= n - 3; i++) {
    if (closes[i] < lo20) lo20 = closes[i];
  }

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.70; // hard stop 30% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lo20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '30% stop' },
               { side: 'sell', price: lo20, trigger: 'below', note: 'exit: 20d low',
                 conds: [{ label: 'close vs 20d low', ok: prevClose >= lo20, closed: true }] }]);
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
