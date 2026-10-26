/*
 * @coinsori-strategy v1
 * name: BTC VolTarget Defensive Long 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Gate-based trend ideas kept the account in cash during BTC's strongest rallies and still lost in crashes. This is the opposite family: ALWAYS invested in BTC, sized by inverse volatility (ATR), with a trend gate that cuts exposure in sustained downtrends. Low vol = big position, high vol = small position, so exposure shrinks before a crash finishes, and the trend gate stops the slow bleed of a long bear market.
 * When it buys and sells: Every day it targets a fixed daily volatility budget (2.5% of equity). It holds more BTC when 14-day ATR is small, less when ATR is large. When the previous close is below the 200-day SMA (a sustained downtrend) it caps exposure at 15% of equity. It rebalances only when the target moves more than 10%. It never fully exits.
 * When it does NOT work: In a choppy sideways market around the 200-day SMA the trend gate can flip repeatedly and pay fees to rebalance. It also lags buy-and-hold in a smooth low-vol bull market because it never goes all-in.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  const smaLong = ctx.sma(200, 1);
  const price = ctx.price;
  if (atr == null || atr <= 0 || prevClose == null || smaLong == null || price == null || price <= 0) return null;

  const pos = ctx.position || 0;
  const equity = ctx.cash + pos * price;

  // Target daily volatility = 2.5% of equity (roughly half of BTC's typical 4-5% daily ATR%).
  const TARGET_VOL = 0.025;
  const realizedVol = atr / price; // ATR as a fraction of price = daily vol proxy
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0); // never more than fully invested

  // Trend gate: below the 200-day SMA is the grinding-bear regime — cap exposure at 15%.
  // This is the fix for the stated weakness (slow bleed while always-long in a bear market).
  const trendUp = prevClose > smaLong;
  if (!trendUp) frac = Math.min(frac, 0.15);

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
