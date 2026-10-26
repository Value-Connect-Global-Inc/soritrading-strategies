/*
 * @coinsori-strategy v1
 * name: BTC VolTarget Defensive Long 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Every gate-based trend idea on this account kept the strategy in cash during BTC's strongest rallies and still lost in crashes. This is the opposite family: it is ALWAYS invested in BTC, but position size is scaled by inverse realized volatility (ATR). When volatility is low the position is large; when volatility spikes the position shrinks automatically before a crash finishes. It bets on BTC's long-run drift while cutting the left tail.
 * When it buys and sells: Every day it targets a fixed daily volatility budget (2.5% of equity). It holds more BTC when 14-day ATR is small and less when ATR is large, rebalancing only when the target moves more than 10%. It never fully exits.
 * When it does NOT work: In a long grinding bear market with persistently high volatility, it holds a small position the whole way down and loses slowly. It also lags buy-and-hold in a smooth low-volatility bull market because it never goes all-in.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  if (atr == null || atr <= 0 || price == null || price <= 0) return null;

  const pos = ctx.position || 0;
  const equity = ctx.cash + pos * price;

  // Target daily volatility = 2.5% of equity (chosen: roughly half of BTC's typical 4-5% daily ATR%).
  const TARGET_VOL = 0.025;
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
