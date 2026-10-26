/*
 * @coinsori-strategy v1
 * name: BTC VolTarget Defensive Long 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Gate-based trend ideas kept the account in cash during BTC's strongest rallies and still lost in crashes. This is the opposite family: ALWAYS invested in BTC, sized by inverse volatility (ATR). Low vol = big position, high vol = small position, so exposure shrinks automatically before a crash finishes. It rides BTC's long-run drift while cutting the left tail.
 * When it buys and sells: Every day it targets a fixed daily volatility budget (2.5% of equity). It holds more BTC when volatility is small, less when large — using the higher of a 7-day and 14-day ATR so exposure cuts faster when a crash starts. It rebalances only when the target moves more than 10%. It never fully exits.
 * When it does NOT work: In a long grinding high-vol bear market it holds a small position the whole way down and loses slowly. It also lags buy-and-hold in a smooth low-vol bull market because it never goes all-in.
 */
function onUpdate(ctx) {
  const atr14 = ctx.atr(14, 1);
  const atr7 = ctx.atr(7, 1);
  const price = ctx.price;
  if (atr14 == null || atr7 == null || atr14 <= 0 || atr7 <= 0 || price == null || price <= 0) return null;

  const pos = ctx.position || 0;
  const equity = ctx.cash + pos * price;

  // Target daily volatility = 2.5% of equity (roughly half of BTC's typical 4-5% daily ATR%).
  const TARGET_VOL = 0.025;
  // max(ATR7, ATR14): reacts to a vol spike (crash start) a week sooner than ATR14 alone,
  // yet behaves like ATR14 in calm markets — cuts exposure faster without over-reacting.
  const realizedVol = Math.max(atr14, atr7) / price;
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
