/*
 * @coinsori-strategy v1
 * name: Funding OI Contrarian BTC Futures 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In perpetual futures, the funding rate is a direct
 * measure of crowding. When funding is strongly positive, longs are paying
 * shorts and the market is crowded long — a squeeze down is more likely.
 * When funding is strongly negative, shorts are paying longs and the market
 * is washed out — a bounce is more likely. Open interest tells us whether
 * that crowding is building (fresh leverage) or unwinding. This bets that
 * extreme positioning mean-reverts.
 * When it buys and sells: buys when funding is deeply negative (shorts
 * crowded) and open interest is not still ballooning; sells/exits when
 * funding turns strongly positive (longs crowded) or stays neutral.
 * When it does NOT work: in a strong one-way trend, crowded positioning can
 * stay crowded and keep running (a melt-up with positive funding, a crash
 * with negative funding) — contrarian entries get run over. It is a
 * mean-reversion bet, so it is wrong exactly when the trend is strongest.
 *
 * 2025-01-01: display-only change — added ctx.watch declarations. Trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Funding rate (fraction, e.g. 0.0001 = 0.01% per funding period).
  const f = ctx.funding;
  if (f == null || !Number.isFinite(f)) return null;

  // Open interest — use it to gauge whether leverage is building or unwinding.
  const oi = ctx.binanceOi ? ctx.binanceOi() : null;
  const oiNow = (oi && Number.isFinite(oi)) ? Number(oi) : null;

  // Rolling funding history to compare current vs recent.
  const hist = ctx.state.fhist || [];
  hist.push(f);
  if (hist.length > 20) hist.shift();
  ctx.state.fhist = hist;
  if (hist.length < 20) return null;

  const prevF = hist[hist.length - 2];

  // Extreme thresholds (fractions). Daily funding of +0.05% is very crowded long,
  // -0.05% is very washed out short. Hysteresis avoids churn at the boundary.
  const CROWDED_LONG = 0.0005;   // longs paying heavily -> crowded long
  const WASHED_SHORT = -0.0005;  // shorts paying heavily -> washed out

  // --- Exit: crowded long (funding strongly positive) -> take profit / de-risk ---
  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: CROWDED_LONG, trigger: 'above', note: 'Funding crowded long', qty: pos }]);
    if (f > CROWDED_LONG) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // --- Entry: washed-out short (funding strongly negative) -> contrarian long ---
  // Require funding to be deeply negative AND not still rising into a fresh
  // crowded-short build (OI not ballooning). Only enter on a genuine washout.
  ctx.watch([{ side: 'buy', price: WASHED_SHORT, trigger: 'below', note: 'Funding washed short', qty: ctx.cash / price * 0.95 }]);
  if (f < WASHED_SHORT) {
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
