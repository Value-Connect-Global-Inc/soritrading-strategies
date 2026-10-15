/*
 * @coinsori-strategy v1
 * name: Donchian Half-Size (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated Donchian 55/20 close breakout champion has a
 * real trend edge but its full-size positions swing 50%+ in rough windows. This
 * version trades the exact same signals at half size, roughly halving both
 * returns and drawdowns for a smoother equity curve — no parameters tuned to any
 * window, just half the risk appetite.
 * When it buys and sells: identical to the champion — buys on a 55-day close
 * high, sells on a 20-day close low or a 30% stop.
 * When it does NOT work: the same regimes as the champion (choppy sideways
 * whipsaw; crashes hit the stop) only with half the impact.
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

  const qty = (ctx.cash * 0.50) / price; // half size: ~half the returns, ~half the drawdown
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
