/*
 * @coinsori-strategy v1
 * name: VolTarget Trend Long BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto has a long-run upward drift but crashes violently.
 * Sizing the position so the account's expected daily volatility stays near a
 * target (ATR vol-targeting) shrinks exposure exactly when markets get wild, and
 * a slow 100-day trend filter gets us out of sustained downtrends. Risk control
 * first, no leverage, never more than 100% invested.
 * When it buys and sells: it holds BTC when price is above its 100-day average,
 * sized = min(1, 2% target daily vol / current ATR%). It trims back to that size
 * as vol rises and sells to cash when price closes below the 100-day average.
 * When it does NOT work: in long flat chop around the average it whipsaws; a gap
 * move can still hurt before the filter reacts. It underperforms buy-and-hold in
 * a clean straight-line bull because the vol target caps exposure.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Closed-bar ATR and SMA so decisions are identical in backtest and live.
  const atr = ctx.atr(14, 1);
  const sma = ctx.sma(100, 1);
  if (atr == null || sma == null) return null;

  const pos = ctx.position;
  const atrPct = atr / price;
  const targetVol = 0.02; // 2% expected daily vol on the whole account: at 2% ATR we are
  // fully invested; at 4% ATR we halve the position. 2% keeps single-day swings
  // survivable without leverage.
  const size = Math.min(1, targetVol / atrPct);
  const trendUp = price > sma;
  const equity = ctx.cash + pos * price; // total account value (cash + held coins)
  const targetQty = trendUp ? (equity * size * 0.95) / price : 0;

  if (pos > 0 && !trendUp) return { side: 'sell', qty: pos };

  if (pos > 0 && trendUp) {
    // Rebalance only when size drifts >15% — avoids churn from tiny ATR wobbles.
    const diff = targetQty - pos;
    if (Math.abs(diff) / Math.max(pos, 1e-9) > 0.15) {
      return { side: diff > 0 ? 'buy' : 'sell', qty: Math.abs(diff) };
    }
    ctx.watch([{ side: 'sell', note: 'exit: close < SMA100',
                 conds: [{ label: 'price vs SMA100', now: price, op: '>', ref: sma, closed: true }] }]);
    return null;
  }

  if (pos <= 0 && trendUp && targetQty > 0) {
    ctx.watch([{ side: 'buy', note: 'enter: close > SMA100',
                 conds: [{ label: 'price vs SMA100', now: price, op: '>', ref: sma, closed: true }] }]);
    return { side: 'buy', qty: targetQty };
  }

  ctx.watch([{ side: 'buy', note: 'enter: close > SMA100',
               conds: [{ label: 'price vs SMA100', now: price, op: '>', ref: sma, closed: true }] }]);
  return null;
}
