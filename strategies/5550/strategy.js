/*
 * @coinsori-strategy v1
 * name: BTC VolTarget Defensive Long 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Gate-based trend ideas kept the account in cash during BTC's strongest rallies and still lost in crashes. This is the opposite family: ALWAYS invested in BTC, sized by inverse volatility (ATR), with an asymmetric risk budget — it risks MORE in uptrends (to capture bulls) and LESS in downtrends (to cut the bear bleed), without ever fully exiting. BTC's returns come from violent V-recoveries, so staying invested is the edge.
 * When it buys and sells: Every day it targets a daily volatility budget: 3.5% of equity when the previous close is above the 200-day SMA (uptrend), 1.5% when below (downtrend). It holds more BTC when 14-day ATR is small, less when ATR is large, and rebalances only when the target moves more than 10%. It never fully exits.
 * When it does NOT work: In a choppy sideways market around the 200-day SMA the regime flips and it pays fees to rebalance. It lags buy-and-hold in a smooth low-vol bull market because it never goes all-in, and it still loses money in a long grinding bear (just less than full exposure would).
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  const sma200 = ctx.sma(200, 1);
  const price = ctx.price;
  if (atr == null || atr <= 0 || prevClose == null || sma200 == null || price == null || price <= 0) return null;

  const pos = ctx.position || 0;
  const equity = ctx.cash + pos * price;

  // Asymmetric risk budget: BTC's drift is dominated by V-recoveries, so risk more in
  // uptrends (capture bulls) and less in downtrends (cut bear bleed). 3.5/1.5 is ~40% up
  // and ~40% down from the original flat 2.5% target — symmetric, no hard cap, no whipsaw.
  const trendUp = prevClose > sma200;
  const TARGET_VOL = trendUp ? 0.035 : 0.015;

  const realizedVol = atr / price; // ATR as a fraction of price = daily vol proxy
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0); // never more than fully invested
  if (frac < 0.05) frac = 0.05; // stay minimally invested even in extreme vol

  const qtyTarget = frac * equity / price;

  // Rebalance only when the target moved materially — avoids daily fee churn.
  const threshold = 0.10;
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < threshold) {
    return null;
  }

  if (qtyTarget > pos) {
    const qty = qtyTarget - pos;
    ctx.watch([{ side:'buy', note:'vol-target rebalance up' }]);
    return { side:'buy', qty: qty };
  }
  if (qtyTarget < pos) {
    const qty = pos - qtyTarget;
    ctx.watch([{ side:'sell', note:'vol-target rebalance down' }]);
    return { side:'sell', qty: qty, reduceOnly: true };
  }
  return null;
}
