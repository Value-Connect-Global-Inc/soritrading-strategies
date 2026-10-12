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
 * (long uptrend). Within that, exposure is scaled down as volatility (ATR) rises.
 * It sells when the trend filter flips off, when volatility makes the target exposure
 * near zero, or when price drops more than 3x the daily range below entry (hard stop).
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
  // Target ~1.5% daily vol (~28% annualized) — roughly half of buy&hold BTC vol, chosen so
  // exposure stays near 0.5 in a normal 3% ATR day and never needs leverage.
  const exposure = Math.min(1, 0.015 / atrPct);
  const targetQty = (ctx.cash * exposure) / price;

  if (pos > 0) {
    // Hard stop: 3x ATR below entry ≈ 3 daily ranges — cuts a fast crash before the trend filter reacts.
    const hardStop = ctx.entryPx - 3 * atr;
    if (price <= hardStop) { ctx.watch([]); return { side: 'sell', qty: pos }; }
    if (!inTrend || exposure < 0.25) { ctx.watch([]); return { side: 'sell', qty: pos }; }
    // Rebalance only when >20% off target — keeps turnover/fees low while staying near target.
    const dev = Math.abs(pos - targetQty) / targetQty;
    if (dev > 0.2) {
      const qty = Math.abs(pos - targetQty);
      ctx.watch([]);
      return { side: pos > targetQty ? 'sell' : 'buy', qty };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR hard stop' }]);
    return null;
  }

  if (inTrend && exposure >= 0.4) {
    const qty = targetQty * 0.99;
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 3 * atr, trigger: 'below', note: '3x ATR hard stop' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([{ side: 'buy', price, trigger: 'above', note: 'trend + vol entry', conds: [
    { label: 'Close > SMA200', ok: inTrend, closed: true },
    { label: 'Target exposure', now: exposure, op: '>=', ref: 0.4 }
  ]}]);
  return null;
}
