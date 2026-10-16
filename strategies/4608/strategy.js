/*
 * @coinsori-strategy v1
 * name: VolTarget Basket 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: a different family from price-trend signals. Crypto is
 * persistently volatile but the volatility itself clusters — calm periods
 * follow calm, crashes follow spikes. A volatility-targeting strategy holds
 * each asset continuously but sizes the position inversely to its recent
 * realized volatility (ATR/price), so the account's risk stays roughly
 * constant: small in a crash, full in a calm uptrend. The single-asset
 * version of this idea beat buy-and-hold on 3 of 4 disjoint windows in this
 * environment (incl. the untouched holdout). This widens it to a 4-coin
 * basket for diversification.
 * When it buys and sells: every bar it computes the target size = targetVol /
 * (ATR(14)/price) for each asset, capped at a share of cash, and rebalances
 * only when the current holding drifts more than 20% from target (deadband
 * limits fee churn). It is always-in — no trend filter, no market timing.
 * When it does NOT work: in a strong bull market it is capped at 1x and
 * underperforms buy-and-hold (it cannot take more than 100% exposure), and
 * it gives back gains in chop because it keeps re-entering after each
 * volatility spike. It is a risk-management strategy: lower drawdown, not
 * maximum return.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  // Per-bar fractional volatility. Target 1.5% per-bar vol per asset: at 6
  // bars/day that is ~24% daily vol, in the same risk ballpark as the trend
  // champion's 1%-risk sizing — chosen so the two are comparable, not tuned.
  const vol = atr / price;
  const targetVol = 0.015;
  let sizeFrac = targetVol / vol;
  if (sizeFrac > 0.25) sizeFrac = 0.25; // cap: 4 assets x 25% = max 100% exposure

  const targetQty = (ctx.cash * sizeFrac) / price;
  const pos = ctx.position;

  if (pos > 0) {
    // Deadband: only rebalance when the holding drifts >20% from target, so
    // calm-period full positions are not churned every bar (fees).
    const drift = Math.abs(targetQty - pos) / pos;
    if (drift < 0.20) return null;
  }

  const qty = targetQty - pos;
  if (Math.abs(qty) < 1e-9) return null;
  return { side: qty > 0 ? 'buy' : 'sell', qty: Math.abs(qty) };
}
