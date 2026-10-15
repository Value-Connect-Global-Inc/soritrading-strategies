/*
 * @coinsori-strategy v1
 * name: Active-Address Confirmed Momentum with EMA50 Crash Exit (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage (daily unique active addresses) tends
 * to GROW while a rally is real and to stall before rallies fade. We only buy when
 * both price momentum AND network usage are rising, so we skip "dead" rallies that
 * price alone would let us into. We add a faster 50-day EMA exit so a real crash
 * is left earlier than waiting for the 200-day EMA alone.
 * When it buys and sells: buys when the 30-day price return is positive, the close
 * is above the 200-day EMA, and active addresses are at/above their 30-day average.
 * Sells when the close falls below the 50-day EMA (fast crash exit), below the
 * 200-day EMA, the 30-day return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: in the early phase of a bull market, right after a crash,
 * usage is still low — the gate can make us miss the first leg of a recovery. The
 * 50-day exit can also exit a position on a sharp but temporary pullback, then
 * re-enter higher.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const ema50 = ctx.ema(50, 1);

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (ema50 != null && prevClose < ema50) return { side: 'sell', qty: pos };  // fast crash exit
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-day crash exit',
                 conds: [{ label: 'close > 200-EMA', ok: prevClose > ema200, closed: true }] },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // Network-usage gate: only buy when active addresses are at/above their 30-day average.
  // If the data is missing on a bar, default to allowing the trade.
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

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
