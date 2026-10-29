/*
 * @coinsori-strategy v1
 * name: DIAG Donchian smoke test 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Diagnostic only: buys whenever the previous close is above SMA20 — a condition
 * that fires many times per year. Purpose: confirm the backtest runner executes
 * this strategy at all (the real Donchian strategy produced 0 trades, which is
 * impossible for a 55-day breakout over 1360 BTC bars).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma20 = ctx.sma(20, 1);
  const atr20 = ctx.atr(20, 1);
  if (sma20 == null || atr20 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: sma20, trigger: 'above', note: 'close above SMA20' }
  ]);

  if (pos > 0) {
    if (prevClose < sma20) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > sma20) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
