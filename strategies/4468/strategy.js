/*
 * @coinsori-strategy v1
 * name: Active-Address Confirmed Momentum with ATR Trail (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage (daily unique active addresses) tends
 * to GROW while a rally is real and to stall before rallies fade. We only buy when
 * both price momentum AND network usage are rising, so we skip "dead" rallies that
 * price alone would let us into. On top of the winning entry logic, we replace the
 * fixed 15%-below-entry stop with an ATR-trailing stop so a 60% run-up does not
 * give back 45% of it before the stop fires.
 * When it buys and sells: buys when the 30-day price return is positive, the close
 * is above the 200-day EMA, and active addresses are at/above their 30-day average.
 * Sells when the close falls below the 200-day EMA, the 30-day return turns negative,
 * or price drops 5 ATR below the highest close since entry (trailing stop).
 * When it does NOT work: in the early phase of a bull market, right after a crash,
 * usage is still low — the gate can make us miss the first leg of a recovery. The
 * trailing stop can whip us out on a sharp but temporary pullback in a strong trend.
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

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    // Trail: 5 ATR below the highest close since entry. 5 ATR (~15 days of vol)
    // is wide enough to survive normal pullbacks yet catches real crashes.
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, prevClose) : prevClose;
    ctx.state.peak = peak;
    let stop = null;
    if (atr != null && atr > 0) stop = peak - 5 * atr;
    if (stop == null) stop = ctx.entryPx * 0.85;   // fallback if ATR missing
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR trail stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  ctx.state.peak = null;   // reset trail when flat

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
