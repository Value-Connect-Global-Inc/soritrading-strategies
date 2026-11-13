/*
 * @coinsori-strategy v1
 * name: BTC 4H Vol-Sized Trend Core
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The plain EMA50/200 trend core is the confirmed control that every
 * external-data gate (funding, on-chain) failed to beat. This replaces the gate idea with
 * a different lever: position SIZING. Volatility clusters (calm follows calm, wild follows
 * wild), so taking a smaller position when 4h volatility is well above its own recent norm
 * should cut the core's drawdowns with little return cost — and needs no external data, so
 * it works anywhere the plain core does.
 * When it buys and sells: Buy when the 4h trend is up (EMA50 above EMA200 and price above
 * EMA50), with position size scaled by how calm volatility is relative to its own 200-bar
 * norm (ATR200/ATR14, clamped to 0.3..1.0 — full size when calm, as low as 30% when wild).
 * Sell when the trend breaks or price falls -25% from entry (same hard stop as the core).
 * When it does NOT work: in a one-way melt-up where volatility keeps rising it sizes down
 * and misses part of the move (still loses to buy-and-hold, like any long-only); in chop it
 * still whipsaws and pays fees; sizing only shrinks the -25% stop, it cannot prevent it.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || prevClose == null) { ctx.watch([]); return null; }
  const trendUp = ema50 > ema200 && prevClose > ema50;

  if (ctx.position > 0) {
    const exitBelow = Math.min(ema50, ema200);
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken' },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -25%' }] : [])
    ]);
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  if (trendUp) {
    // vol scale: ATR(14) vs its own slow norm ATR(200). Ratio <1 when vol is elevated -> smaller size.
    const atrFast = ctx.atr(14, 1);
    const atrSlow = ctx.atr(200, 1);
    let scale = 1;
    if (atrFast != null && atrSlow != null && atrFast > 0) {
      scale = Math.min(1, Math.max(0.3, atrSlow / atrFast));
    }
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up', conds: [{ label: 'vol scale', now: scale, op: '>=', ref: 0.3, closed: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99 * scale;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting trend up' }]);
  return null;
}
