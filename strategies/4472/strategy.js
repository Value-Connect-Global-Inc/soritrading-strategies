/*
 * @coinsori-strategy v1
 * name: Active-Address Confirmed Momentum (BTC 1D) ATR-Stop
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same gate and momentum core as the champion, but the hard
 * stop is scaled to volatility (2.5 x ATR at entry) instead of a fixed 15%.
 * A fixed percentage stop is whipsawed by normal daily noise in high-volatility
 * regimes and too loose in quiet ones — scaling the stop to the market's own
 * volatility is a regime-adaptive risk rule.
 * When it buys and sells: buys when 30d return > 0, close above 200d EMA, and
 * active addresses >= their 30d average. Sells when the close falls below the
 * 200d EMA, 30d return turns negative, or the ATR-scaled stop is hit.
 * When it does NOT work: in a slow grinding bear market the wide ATR stop can
 * let a position ride down longer than a fixed 15% stop would. The gate also
 * only checks BTC usage, so it adds no protection to other coins.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atrPct = atr / prevClose;
  let volScale = 1;
  if (prevClose > 0) volScale = Math.min(1, 0.02 / atrPct);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    // stop captured at entry time (2.5 ATR below entry) — regime-adaptive, not fixed 15%
    let stopPx = ctx.state.stopPx;
    if (stopPx == null) stopPx = ctx.entryPx - 2.5 * atr;   // fallback: current ATR
    if (price <= stopPx) { ctx.state.stopPx = null; return { side: 'sell', qty: pos }; }
    if (prevClose < ema200) { ctx.state.stopPx = null; return { side: 'sell', qty: pos }; }
    if (mom30 < 0) { ctx.state.stopPx = null; return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '2.5 ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'active addr >= 30d avg', ok: usageUp, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  ctx.state.stopPx = price - 2.5 * atr;      // capture the ATR stop at entry
  return { side: 'buy', qty };
}
