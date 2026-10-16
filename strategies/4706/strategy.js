/*
 * @coinsori-strategy v1
 * name: BTC Donchian Wide-Exit 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The standard 20-bar low Donchian exit gets shaken out of strong bull markets
 * by ordinary pullbacks (a 3-week dip breaks the 20-bar low, then price resumes up). Widening the
 * exit to the 55-bar low keeps the position through normal corrections so the trend can run.
 * When it buys and sells: buys when a closed daily bar breaks the 55-bar high. Sells on a 2x ATR
 * hard stop or when a closed bar breaks the 55-bar low. Position size is scaled down when volatility
 * is high to cap drawdown.
 * When it does NOT work: the wider exit gives back more profit on reversals before exiting (bigger
 * round-trip drawdown per trade). In a choppy sideways market the 55-bar breakout whipsaws and the
 * wide exit delays cutting losses. Drawdowns can still reach ~30-40% in sharp reversals.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 120) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l55 = Infinity;
  for (let k = 3; k <= 57; k++) l55 = Math.min(l55, c.at(-k));

  const NB = c.length - 2;
  const prevClose = c.at(-2);
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l55) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l55, trigger: 'below', note: '55-bar low breakdown' }]);
    return null;
  }

  if (!(prevClose > h55)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 1.5% of price per ATR)
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const qty = (ctx.cash * 0.99 * volScale) / price;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout' }]);
  return { side: 'buy', qty };
}
