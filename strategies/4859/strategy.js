/*
 * @coinsori-strategy v1
 * name: YieldCurveGatedBtc1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: a deeply inverted US yield curve (10Y minus 3M) historically
 * precedes recessions and broad risk-off, which drags crypto down with it. This
 * bets that during deep inversion, holding cash protects the account better than
 * chasing momentum.
 * When it buys and sells: buys BTC when 30-day momentum is positive AND the yield
 * curve is not deeply inverted (spread above -1.5pp). Sells when 30-day momentum
 * turns negative, price falls 3x ATR below entry, or the position is down 20%.
 * When it does NOT work: crypto rallied hard in 2023-24 while the curve was deeply
 * inverted, so the gate can sit in cash during a crypto bull. A steeply positive
 * curve is not a guarantee of a bull either.
 */
function onUpdate(ctx) {
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const spread = ctx.data("base_t10y3m"); // 10Y-3M spread in percentage points
  if (spread == null) return null;
  const riskOn = spread > -1.5; // only deep inversion (2023-24 style) counts as risk-off

  const pos = ctx.position;
  const mom = ctx.change(30, 1); // 30-day momentum as a fraction (0.05 = 5%) on closed bars
  if (mom == null) return null;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    const entry = ctx.entryPx;
    let stopPx = null;
    if (atr != null && entry != null) stopPx = entry - 3 * atr; // 3x ATR trail from entry
    const hardStop = entry != null ? entry * 0.8 : null; // -20% disaster stop
    const exitPx = (stopPx != null && hardStop != null) ? Math.max(stopPx, hardStop) : (stopPx != null ? stopPx : hardStop);
    ctx.watch([{ side: 'sell', price: exitPx, trigger: 'below', note: 'ATR trail or -20% stop' },
               { side: 'sell', note: 'momentum < -2%', conds: [{ label: '30d mom', now: mom, op: '<', ref: -0.02, closed: true }] }]);
    if (mom < -0.02) return { side: 'sell', qty: pos }; // momentum broke = trend over
    if (exitPx != null && px <= exitPx) return { side: 'sell', qty: pos };
    return null;
  }

  ctx.watch([{ side: 'buy', note: 'mom>2% & curve not deep-inverted', conds: [
    { label: '30d mom', now: mom, op: '>', ref: 0.02, closed: true },
    { label: '10Y-3M spread', now: spread, op: '>', ref: -1.5, closed: true }
  ]}]);
  if (riskOn && mom > 0.02) { // positive momentum + normal curve = trend regime
    const qty = (ctx.cash / px) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
