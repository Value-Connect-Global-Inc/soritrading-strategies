/*
 * @coinsori-strategy v1
 * name: VolTargetTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: instead of betting a fixed amount, it sizes its position so the
 * portfolio carries roughly constant risk: it holds MORE in calm markets and LESS in
 * wild ones. Smoothing volatility over time avoids the deep drawdowns of a fixed bet
 * while still capturing the trend.
 * When it buys and sells: invests only while price is above its 200-day average
 * (long uptrend). The entry size is scaled down as volatility (ATR) rises, so calm
 * periods get a bigger bet and wild periods a smaller one. It sells the whole
 * position when the trend filter flips off or when price drops more than 3x the
 * daily range below entry (hard stop).
 * When it does NOT work: in a long flat sideways market it churns small positions and
 * pays fees; it lags buy-and-hold in a straight-line melt-up because it intentionally
 * holds less than 100% most of the time.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const inTrend = prevClose > sma200;
  const atrPct = atr / price;
  // Target ~2.0% daily vol (~38% annualized): deploys ~0.65 of cash in a normal 3% ATR day.
  // Entry sizing only — no intra-position rebalance (the rebalance version was non-monotonic
  // and sold into vol spikes at bad prices, so it is removed).
  const exposure = Math.min(1, 0.02 / atrPct);
  const targetQty = (ctx.cash * exposure) / price;

  if (pos > 0) {
    // Exit conditions: trend flip, vol collapse, or hard stop 3x ATR below entry.
    const hardStop = ctx.entryPx - 3 * atr;
    if (price <= hardStop || !inTrend || exposure < 0.25) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR hard stop' }]);
    return null;
  }

  if (inTrend && exposure >= 0.4) {
    const qty = targetQty * 0.99;
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 3 * atr, trigger: 'below', note: '3x ATR hard stop' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'trend + vol entry', conds: [
    { label: 'Close > SMA200', ok: inTrend, closed: true },
    { label: 'Target exposure', now: exposure, op: '>=', ref: 0.4 }
  ]}]);
  return null;
}
