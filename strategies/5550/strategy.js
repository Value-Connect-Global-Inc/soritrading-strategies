/*
 * @coinsori-strategy v1
 * name: BTC VolTarget Defensive Long 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Every gate-based trend idea kept the account in cash during BTC's strongest rallies and still lost in crashes. This is the opposite family: ALWAYS invested in BTC, sized by inverse volatility (ATR). Low vol = big position, high vol = small position, so exposure shrinks automatically before a crash finishes. It rides BTC's long-run drift while cutting the left tail.
 * When it buys and sells: Every day it targets a fixed daily volatility budget (1.8% of equity). It holds more BTC when 14-day ATR is small, less when ATR is large, rebalancing only when the target moves more than 10%. A hard 2.5x ATR stop caps any single drawdown.
 * When it does NOT work: In a long grinding high-vol bear market it holds a small position the whole way down and loses slowly. It also lags buy-and-hold in a smooth low-vol bull market because it never goes all-in.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const price = ctx.price;
  if (atr == null || atr <= 0 || price == null || price <= 0) return null;

  const pos = ctx.position || 0;
  const entry = ctx.entryPx;
  const equity = ctx.cash + pos * price;

  // Hard stop: exit if price falls 2.5x ATR below entry (caps single-trade tail risk).
  if (pos > 0 && entry != null) {
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'hard stop 2.5x ATR' }]);
    if (price <= stop) return { side:'sell', qty: pos, reduceOnly: true };
  }

  // Target daily vol = 1.8% of equity (defensive: keeps position modest even in calm markets).
  const TARGET_VOL = 0.018;
  const realizedVol = atr / price;
  let frac = TARGET_VOL / realizedVol;
  frac = Math.min(frac, 1.0);
  if (frac < 0.05) frac = 0.05;

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
