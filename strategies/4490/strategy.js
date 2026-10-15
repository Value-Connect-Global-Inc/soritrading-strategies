/*
 * @coinsori-strategy v1
 * name: Fed-Regime Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset that tends to do well when the Fed is
 * easing or rates are low, and struggles when the Fed is hiking into high rates.
 * This tests the Fed funds rate as the "is it safe to be in crypto" gate, on the
 * same price-momentum core as the champion (30d return > 0, close > 200d EMA).
 * It is an A/B against the champion's active-address gate: same engine, different
 * risk gate.
 * When it buys and sells: buys when momentum is up AND the Fed is accommodative
 * (rate below 2.5% OR rate has fallen in the last 30 days). Sells on a 200d EMA
 * break, 30d return turning negative, or a 15% hard stop.
 * When it does NOT work: in a regime where the Fed keeps rates high but crypto
 * rallies anyway (e.g. a liquidity-driven bull with sticky inflation), the gate
 * keeps us out of the whole move. It also adds no protection within a single
 * drawdown — it only filters the regime, not the trade.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  // Fed regime gate: accommodative = rate low (<2.5%, roughly below the
  // historical neutral) OR easing (rate below its 30-day-ago value).
  const fed = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  let fedEasy = true;
  if (fed != null) {
    fedEasy = fed < 2.5;
    if (fedLag != null && fed < fedLag) fedEasy = true;
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    if (mom30 < 0) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200d trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200d EMA',
    conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
            { label: 'close > 200-EMA', ok: uptrend, closed: true },
            { label: 'Fed accommodative', ok: fedEasy, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !fedEasy) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
