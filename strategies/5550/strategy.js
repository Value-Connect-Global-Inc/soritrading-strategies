/*
 * @coinsori-strategy v1
 * name: BTC VolTarget Defensive Long 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Gate-based trend ideas kept the account in cash during BTC's strongest rallies. This is the opposite: ALWAYS invested in BTC, sized by inverse volatility (ATR). Low vol = big position, high vol = small position. On top of that, when price is below its 200-day average (confirmed bear), the volatility budget is cut to a third — so the strategy rides bull markets but is small during bears.
 * When it buys and sells: Every day it targets a daily volatility budget (2.5% of equity in uptrends, 0.8% in confirmed downtrends). It holds more BTC when 14-day ATR is small, less when ATR is large, rebalancing only when the target moves more than 10%. It never fully exits.
 * When it does NOT work: In a choppy bear that hugs the 200-day average, the trend filter flips on and off and the strategy churns. It also lags buy-and-hold in a smooth low-vol bull market because it never goes all-in.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || price == null || price <= 0 || sma200 == null) return null;

  const pos = ctx.position || 0;
  const equity = ctx.cash + pos * price;

  // Trend regime: 2.5% vol budget in uptrend, 0.8% in confirmed downtrend (cut exposure in bears).
  const TARGET_VOL = price > sma200 ? 0.025 : 0.008;
  const realizedVol = atr / price;
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.02) frac = 0.02;

  const qtyTarget = frac * equity / price;

  // Rebalance only when target moved materially (avoids daily fee churn).
  const threshold = 0.10;
  if (pos > 0 && Math.abs(qtyTarget - pos) / Math.max(qtyTarget, pos) < threshold) return null;

  if (qtyTarget > pos) {
    ctx.watch([{ side:'buy', note:'vol-target rebalance up' }]);
    return { side:'buy', qty: qtyTarget - pos };
  }
  if (qtyTarget < pos) {
    ctx.watch([{ side:'sell', note:'vol-target rebalance down' }]);
    return { side:'sell', qty: pos - qtyTarget, reduceOnly: true };
  }
  return null;
}
