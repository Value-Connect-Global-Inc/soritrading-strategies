/*
 * @coinsori-strategy v1
 * name: Donchian + Chandelier Exit (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated Donchian 55/20 close breakout has a real
 * trend edge but its exits lag in crashes (20d low exit + 30% hard stop →
 * 50%+ drawdowns on rough windows). A chandelier trailing stop (highest close
 * since entry minus 3xATR) ratchets up with the trend: it locks in gains during
 * a rally and exits fast in a crash, keeping the same full-size trend riding.
 * When it buys and sells: buys when the close makes a new 55-day high, full
 * size. Sells when price falls 3xATR below the highest close since entry, or
 * when the close makes a new 20-day low.
 * When it does NOT work: in choppy sideways markets the 55/20 breakout whipsaws
 * and the 3xATR trailing stop adds churn; in a slow grind down the chandelier
 * can trail too tightly and exit before the 20d low confirms the trend turn.
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
    // track highest close since entry (chandelier anchor)
    let hi = ctx.state.hi;
    if (hi == null || price > hi) hi = price;
    ctx.state.hi = hi;

    const chandelier = hi - 3 * atr; // trailing stop: 3xATR below the running high
    if (price <= chandelier) return { side: 'sell', qty: pos };
    if (prevClose < lo20) return { side: 'sell', qty: pos }; // trend backstop: 20d close low
    ctx.watch([{ side: 'sell', price: chandelier, trigger: 'below', note: 'chandelier stop' },
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
