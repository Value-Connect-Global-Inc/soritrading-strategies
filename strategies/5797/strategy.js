/*
 * @coinsori-strategy v1
 * name: MultiAsset VolTarget Long Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A risk-parity / volatility-targeting long basket. It holds all five
 * major coins at all times, weighting each by the inverse of its recent realized volatility,
 * so calm assets get more capital and wild assets get less. Rebalanced every 10 days.
 * The bet: a diversified vol-weighted long captures the crypto long-term uptrend with a
 * smoother equity curve than equal-weight or single-name holding.
 * When it does NOT work: In a broad coordinated crypto bear (all five fall together) there
 * is no diversification benefit — the basket falls with the market and the vol-weighting
 * does not protect it. It also never goes to cash, so it eats every drawdown.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const atr = ctx.atr(14, 1);
  const ema50 = ctx.ema(50, 1);
  if (atr == null || atr <= 0 || ema50 == null) return null;

  // Realized vol proxy: ATR as a fraction of the 50-bar EMA (higher = wilder).
  const volFrac = atr / ema50;

  // Rebalance every 10 bars. Track last rebalance bar in ctx.state (survives restart).
  const lastReb = ctx.state.lastReb != null ? ctx.state.lastReb : -999;
  if (ctx.i - lastReb < 10) {
    return null;
  }
  ctx.state.lastReb = ctx.i;

  // Target this leg's share of the portfolio. With 5 legs and inverse-vol weighting,
  // a leg's weight = (1/volFrac) / sum(1/volFrac). We can't see other legs' vol here,
  // so each leg independently targets a share proportional to its own calmness, capped
  // at 40% of cash so no single leg dominates. This is a per-leg approximation of
  // risk-parity that needs no cross-symbol reads.
  const weight = Math.min(0.40, 0.25 * (0.02 / Math.max(volFrac, 0.005)));
  const targetQty = (ctx.cash * weight) / price;
  const pos = ctx.pos(sym);
  if (pos > 0) {
    const diff = targetQty - pos;
    if (Math.abs(diff) / pos > 0.05) {
      if (diff > 0) return { side: 'buy', qty: diff };
      return { side: 'sell', qty: -diff, reduceOnly: true };
    }
    return null;
  }
  if (targetQty > 0) return { side: 'buy', qty: targetQty };
  return null;
}
