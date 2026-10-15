/*
 * @coinsori-strategy v1
 * name: Dual-Confirmed Momentum (OBV + Active-Address) BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Combines the two independently-validated signal families —
 * on-chain usage (active addresses) and volume flow (OBV). A rally is only bought
 * when BOTH the network usage AND the volume flow confirm it, so the entry is
 * stronger than either signal alone.
 * When it buys and sells: buys when 30d return > 0, close above 200d EMA, active
 * addresses >= their 30d average, AND smoothed OBV is rising (1% hysteresis).
 * Sells when close falls below 200d EMA, 30d return turns negative, or 15% stop.
 * When it does NOT work: requires more conditions to align, so it may enter later
 * and miss sharp V-recoveries; in choppy sideways markets OBV can diverge from
 * price and delay entries. The gate only checks BTC usage.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  const vols = ctx.volumes;
  if (!c || !vols || c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // Build OBV from volume and close direction (same as validated strategy 2779).
  let obv = 0;
  const obvSeries = [];
  for (let k = 1; k < c.length; k++) {
    const cl = c[k], pr = c[k - 1], v = vols[k];
    if (!Number.isFinite(cl) || !Number.isFinite(pr) || !Number.isFinite(v)) continue;
    if (cl > pr) obv += v; else if (cl < pr) obv -= v;
    obvSeries.push(obv);
  }
  if (obvSeries.length < 32) return null;
  const obvNow = obvSeries[obvSeries.length - 1];
  const obvPast = obvSeries[obvSeries.length - 31];
  const obvRising = obvNow > obvPast * 1.01;   // 1% hysteresis (same as validated OBV strategy)

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
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
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
                       { label: 'addr >= 30d avg', ok: usageUp, closed: true },
                       { label: 'OBV rising', ok: obvRising, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp || !obvRising) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
