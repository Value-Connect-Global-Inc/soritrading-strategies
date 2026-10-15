/*
 * @coinsori-strategy v1
 * name: Miner-Capitulation Recovery (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: when mining becomes unprofitable, miners switch off machines and
 * Bitcoin's network hash rate FALLS below its recent average — a capitulation event
 * that historically marks near-term bottoms. We buy that stress only inside an intact
 * long-term uptrend, so we are not catching a falling knife in a bear market.
 * When it buys and sells: buys when the hash rate drops below its 30-day average while
 * the close is above the 200-day EMA. Sells when the close falls below the 200-day EMA,
 * the 30-day price return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: in a prolonged bear market the hash rate stays low and the
 * 200-day EMA keeps falling — the strategy stays flat and misses nothing, but it also
 * never buys. In a steady grind-up bull market where hash rate never dips below its
 * average, it never gets a chance to enter and underperforms buy-and-hold.
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
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // Miner-capitulation gate: only buy when the network hash rate is BELOW its 30-day
  // average (miners stressed). If the data is missing on a bar, default to NO trade —
  // a missing signal must never turn into a buy.
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  if (hr == null || hrAvg == null || hrAvg <= 0) return null;
  const minersStressed = hr < hrAvg;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'hashrate < 30d avg', ok: minersStressed, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !minersStressed) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
