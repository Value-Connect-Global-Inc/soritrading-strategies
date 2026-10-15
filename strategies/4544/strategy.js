/*
 * @coinsori-strategy v1
 * name: Donchian + Chandelier 5xATR (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated Donchian 55/20 breakout has a real trend
 * edge but 50%+ drawdowns in crashes. A chandelier trailing stop at 5xATR
 * (~20% buffer, matching crypto's violent pullback scale) ratchets up with the
 * trend to lock in gains, while a 30% hard stop below entry stays as an
 * absolute floor. 3xATR was too tight and whipsawed; 5xATR is wide enough to
 * ride crypto trends.
 * When it buys and sells: buys when the close makes a new 55-day high, full
 * size. Sells when price falls 5xATR below the highest close since entry, hits
 * the 30% stop, or the close makes a new 20-day low.
 * When it does NOT work: in choppy sideways markets the 55/20 breakout whipsaws;
 * in a slow grind down the chandelier trails too tightly and exits early.
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

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    let hi = ctx.state.hi;
    if (hi == null || price > hi) hi = price;
    ctx.state.hi = hi;

    const hardStop = ctx.entryPx * 0.70; // absolute 30% floor (champion's stop)
    const chandelier = hi - 5 * atr; // 5xATR trailing buffer (~20% of price)
    const stopPx = Math.max(chandelier, hardStop);
    if (price <= stopPx) return { side: 'sell', qty: pos };
    if (prevClose < lo20) return { side: 'sell', qty: pos }; // trend backstop: 20d close low
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'trail/30% stop' },
               { side: 'sell', price: lo20, trigger: 'below', note: 'exit: 20d low',
                 conds: [{ label: 'close vs 20d low', ok: prevClose >= lo20, closed: true }] }]);
    return null;
  }

  const breakout = prevClose > hi55;
  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'enter: 55d high',
               conds: [{ label: 'close vs 55d high', ok: breakout, closed: true }] }]);
  if (!breakout) return null;

  const qty = (ctx.cash * 0.95) / price; // full size, same as champion
  if (qty <= 0) return null;
  ctx.state.hi = price; // chandelier starts anchored at entry
  return { side: 'buy', qty };
}
