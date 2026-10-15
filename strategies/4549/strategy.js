/*
 * @coinsori-strategy v1
 * name: Donchian 55/30 Vol-Scaled (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same trend-following core as the champion (55-day close
 * high entry, 30-day close low exit, 30% stop) but position size shrinks when
 * daily volatility is high, so a crash does not hit the full account.
 * When it buys and sells: buys on a 55-day close high, sized by volatility —
 * full size when ATR(20)/price <= 3%, proportionally smaller when vol is higher.
 * Sells on a 30-day close low or a 30% hard stop.
 * When it does NOT work: in a long sideways market the breakout whipsaws; the
 * vol-scaling only caps, not removes, the loss on a fast crash (the 30-day exit
 * still lags and the stop still takes a hit).
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
  let lo30 = Infinity;
  for (let i = n - 2 - 30; i <= n - 3; i++) {
    if (closes[i] < lo30) lo30 = closes[i];
  }

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.70;
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

  // Vol-targeting: ATR(20) as fraction of price, 3% = full size, scale down above it.
  // Reason: high daily vol means bigger swings per position, so halving size in a
  // 6%-ATR regime keeps the account drawdown comparable across regimes.
  const atr = ctx.atr(20, 1);
  let frac = 0.95;
  if (atr != null) {
    const atrPct = atr / prevClose;
    if (atrPct > 0.03) frac = 0.95 * (0.03 / atrPct);
    frac = Math.max(0.10, Math.min(0.95, frac));
  }

  const qty = (ctx.cash * frac) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
