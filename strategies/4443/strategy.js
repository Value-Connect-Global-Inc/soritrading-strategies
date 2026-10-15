/*
 * @coinsori-strategy v1
 * name: Bollinger MR in Uptrend Basket 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a bull market, sharp short-term drops are usually
 * pullbacks, not the start of a bear — prices snap back to the mean. This is
 * the OPPOSITE bet to trend-following: it buys weakness instead of strength.
 * It only fades pullbacks that happen ABOVE the 200-day EMA, so it never
 * catches a falling knife in a confirmed downtrend.
 * When it buys and sells: a leg buys when the previous close is below the lower
 * Bollinger band (20, 2) while the close is still above the 200-day EMA. It
 * sells when the close climbs back above the middle band (20-day SMA), when the
 * close falls below the 200-day EMA, or when a 10% hard stop is hit.
 * When it does NOT work: in a strong persistent downtrend the pullback never
 * snaps back and the stop is hit repeatedly; and during a broad crash the
 * uptrend filter fails too late. It also misses prolonged one-way rallies.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 21) return null;
  const prevClose = c.at(-2);

  const bb = ctx.bb(20, 2, 1);       // Bollinger on the last CLOSED bar
  if (bb == null || bb.lower == null || bb.mid == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.90;   // tight stop: MR is a quick trade
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // uptrend broken
    if (prevClose > bb.mid) return { side: 'sell', qty: pos };   // reverted to the mean
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '10% stop' },
               { side: 'sell', price: bb.mid, trigger: 'above', note: 'back to mid band' },
               { side: 'sell', price: ema200, trigger: 'below', note: 'uptrend broken' }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  const oversold = prevClose < bb.lower;
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'close below lower BB',
               conds: [{ label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !oversold) return null;

  // vol-targeted size: ~2% daily vol per leg
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }
  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
