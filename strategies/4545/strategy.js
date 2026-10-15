/*
 * @coinsori-strategy v1
 * name: Donchian + Macro Availability Test (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Champion Donchian 55/20 logic with one addition — it only
 * enters when ctx.macro('dxy') is NOT null (any value passes the filter). This
 * isolates whether macro data exists inside a backtest: if it does, results
 * match the champion; if it does not, we get 0 trades and know the macro axis is
 * unavailable, like OI/derivatives were.
 * When it buys and sells: identical to the champion (55d high buy, 20d low /
 * 30% stop sell) except the macro-null gate.
 * When it does NOT work: N/A — availability test.
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
    const stop = ctx.entryPx * 0.70;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lo20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '30% stop' },
               { side: 'sell', price: lo20, trigger: 'below', note: 'exit' }]);
    return null;
  }

  const dxy = ctx.macro('dxy'); // availability gate — any non-null value passes
  if (dxy == null) return null; // macro data absent in backtest → don't trade

  const breakout = prevClose > hi55;
  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'enter: 55d high',
               conds: [{ label: 'close vs 55d high', ok: breakout, closed: true },
                       { label: 'macro dxy present', ok: dxy != null, closed: true }] }]);
  if (!breakout) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
