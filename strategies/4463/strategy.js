/*
 * @coinsori-strategy v1
 * name: Fed-Policy Regime Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset whose rallies are helped by easy
 * money. When the Fed is actively raising rates, liquidity tightens and crypto
 * tends to fall. We ride momentum only in a neutral/easing policy regime.
 * When it buys and sells: buys when the 30-day return is positive, the close is
 * above the 200-day EMA, and the Fed has not raised rates in the last 30 days.
 * Sells when the close falls below the 200-day EMA, the 30-day return turns
 * negative, a 15% hard stop is hit, or the Fed starts raising again.
 * When it does NOT work: in a bull market driven by pure retail speculation
 * while the Fed is still hiking — the policy filter keeps us out of the early
 * rally. And when the Fed is on hold for a long time, the filter adds nothing
 * and we are just momentum with a stop.
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

  // Fed policy regime: current fed funds rate vs its level 30 days ago.
  // If the Fed hiked within the last month, liquidity headwind → stay out.
  // Missing data → allow (never silently block on missing data).
  const fed = ctx.data('fed');
  const fedLag = ctx.data('fed_lag30');
  let easing = true;
  if (fed != null && fedLag != null) easing = fed <= fedLag;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    if (mom30 < 0) return { side: 'sell', qty: pos };
    if (!easing) return { side: 'sell', qty: pos };   // Fed started hiking → exit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                         { label: 'Fed not hiking', ok: easing, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'Fed not hiking', ok: easing, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !easing) return null;

  const qty = (ctx.cash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
