/*
 * @coinsori-strategy v1
 * name: Multi-Asset Mean Reversion Basket
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto alternates between trending and mean-reverting
 * regimes. In the mean-reverting regime, sharp single-day drops overshoot and
 * snap back toward the recent average. This buys those overshoots on a 4-coin
 * basket (so no single coin decides the account) and sells when price returns
 * to the mean. It is the opposite philosophy of the trend-following baseline.
 * When it buys and sells: on each asset, buy when RSI(14) is below 30 (deep
 * oversold) AND price is below the lower Bollinger Band (20, 2) — a stretched
 * drop. Sell when price climbs back to its 20-day average (the snap-back is
 * done), or when price drops 25% below entry (hard stop).
 * When it does NOT work: in a sustained bear market every "oversold" dip keeps
 * falling — the strategy catches knives and the 25% stop realizes the losses.
 * It also stays flat during strong trends because there are no oversold dips
 * to buy, missing the move entirely.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 25% hard stop: caps the loss on any single position.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Exit: mean reversion is done — price is back at its 20-day average.
    const sma20 = ctx.sma(20, 1);
    if (sma20 != null && price >= sma20) return { side: 'sell', qty: pos };
    return null;
  }

  // All entry signals on CLOSED bars so they are identical live and in backtest.
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  if (rsi == null || bb == null) return null;

  // Entry: deep oversold (RSI<30) AND price stretched below the lower band.
  if (rsi < 30 && price < bb.lower) {
    // Fixed 95% sizing per asset — matches the proven baseline sizing.
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: bb.lower,
    trigger: 'below',
    note: 'enter: oversold dip below BB lower',
    conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }]
  }]);
  return null;
}
