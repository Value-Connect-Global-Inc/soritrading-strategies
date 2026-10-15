/*
 * @coinsori-strategy v1
 * name: VolTarget Donchian Trend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto trends hard but crashes violently. A Donchian
 * 20-day breakout enters only after a real up-move, and ATR vol-targeting
 * shrinks the position exactly when markets get wild. Risk control first, no
 * leverage, never more than 100% invested.
 * When it buys and sells: buys when price breaks the 20-day high, sells when it
 * breaks the 10-day low (classic turtle). Position size = min(1, 2% target
 * daily vol / current ATR%) so exposure falls as volatility rises.
 * When it does NOT work: in a long sideways range the 20/10 breakout whipsaws;
 * a gap down can hurt before the 10-day exit reacts. It lags buy-and-hold in a
 * straight-line bull because the vol target caps exposure and the exit is slow.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // 20-day high / 10-day low from CLOSED bars so backtest == live.
  const hh = ctx.high(20, 1);
  const ll = ctx.low(10, 1);
  if (hh == null || ll == null) return null;

  const pos = ctx.position;
  const atrPct = atr / price;
  const targetVol = 0.02; // 2% expected daily vol on the account: at 2% ATR we are
  // fully invested, at 4% ATR we halve. Keeps single-day swings survivable.
  const size = Math.min(1, targetVol / atrPct);
  const equity = ctx.cash + pos * price;
  const targetQty = (equity * size * 0.95) / price;

  if (pos > 0) {
    if (price < ll) return { side: 'sell', qty: pos };
    // Rebalance only on >15% drift to avoid churn from tiny ATR wobbles.
    const diff = targetQty - pos;
    if (Math.abs(diff) / Math.max(pos, 1e-9) > 0.15) {
      return { side: diff > 0 ? 'buy' : 'sell', qty: Math.abs(diff) };
    }
    ctx.watch([{ side: 'sell', price: ll, trigger: 'below', note: 'exit: 10d low' }]);
    return null;
  }

  if (price > hh && targetQty > 0) {
    ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'enter: 20d high' }]);
    return { side: 'buy', qty: targetQty };
  }

  ctx.watch([{ side: 'buy', price: hh, trigger: 'above', note: 'enter: 20d high' }]);
  return null;
}
