/*
 * @coinsori-strategy v1
 * name: BTC Mean Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On a 4h timeframe, sharp drops to oversold conditions
 * (RSI below 30 and price below the lower Bollinger band) often snap back to the
 * mean. We buy the panic and sell the recovery, capturing the bounce without
 * holding through a full trend. A hard stop cuts losses when the mean reversion
 * fails and the drop continues.
 * When it buys and sells: buy when the last closed 4h bar has RSI(14) < 30 and
 * close below the lower Bollinger band (20,2). Sell when price closes back above
 * the 20-SMA (mean), RSI climbs above 55, or an 8% hard stop is hit.
 * When it does NOT work: in a strong persistent downtrend the oversold bounce
 * never comes and every dip keeps falling — the stop takes repeated small losses.
 * It also misses strong one-way rallies because it sells too early at the mean.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 30) return null;
  const prevClose = c.at(-2);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.92;   // hard stop 8% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const sma20 = ctx.sma(20, 1);
    const rsi = ctx.rsi(14, 1);
    if (sma20 != null && prevClose > sma20) return { side: 'sell', qty: pos }; // mean reached
    if (rsi != null && rsi > 55) return { side: 'sell', qty: pos };            // oversold resolved
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '8% stop' },
               { side: 'sell', price: sma20, trigger: 'above', note: 'mean reached',
                 conds: [{ label: 'RSI(14) > 55', ok: rsi > 55, closed: true }] }]);
    return null;
  }

  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (bb == null || rsi == null) return null;
  const oversold = prevClose < bb.lower && rsi < 30;
  if (!oversold) return null;

  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'lower BB touch',
               conds: [{ label: 'RSI(14) < 30', now: rsi, op: '<', ref: 30, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.01 / atrPct);   // 4h is noisier: target 1% ATR, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
