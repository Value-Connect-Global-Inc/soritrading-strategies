/*
 * @coinsori-strategy v1
 * name: Donchian Trend Breakout Wide Exit 40 (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Classic trend-following — a 55-day close high marks the
 * start of a new up-leg, and a 40-day close low exit cuts the trend when it
 * turns. Even wider exit than the champion's 30-day to let winners run longer.
 * When it buys and sells: buys when the close makes a new 55-day high. Sells
 * when the close makes a new 40-day low, or a 30% hard stop is hit.
 * When it does NOT work: in choppy sideways markets the 55/40 breakout whipsaws
 * repeatedly; in fast crashes the 40-day low exit lags even more than 30-day and
 * the stop takes a big hit before the exit fires.
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
  let lo40 = Infinity;
  for (let i = n - 2 - 40; i <= n - 3; i++) {
    if (closes[i] < lo40) lo40 = closes[i];
  }

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.70;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lo40) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '30% stop' },
               { side: 'sell', price: lo40, trigger: 'below', note: 'exit: 40d low',
                 conds: [{ label: 'close vs 40d low', ok: prevClose >= lo40, closed: true }] }]);
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
