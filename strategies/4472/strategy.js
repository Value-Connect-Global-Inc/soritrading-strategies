/*
 * @coinsori-strategy v1
 * name: Active-Address Confirmed Momentum (BTC 1D) + Override
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same as champion — buy only when price momentum AND network
 * usage are rising. PLUS a momentum override: after a crash, price recovers before
 * on-chain usage catches up, so we also allow entry when the 30-day return is
 * extremely strong even if active addresses still lag their average. This fixes
 * the champion's documented weakness of missing the first leg of a recovery.
 * When it buys and sells: buys when 30-day return > 0, close above 200-day EMA,
 * and (active addresses >= 30d avg OR 30-day return >= 30%). Sells when close
 * falls below 200-day EMA, 30-day return turns negative, or 15% hard stop.
 * When it does NOT work: the override can let in a dead rally that price alone
 * would allow — the gate is weaker. In a choppy sideways market the override
 * never triggers (momentum never extreme) so behavior matches the champion.
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

  // Network-usage gate: only buy when active addresses are at/above their 30-day average.
  // If the data is missing on a bar, default to allowing the trade so the strategy
  // never silently blocks on missing data.
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  // Momentum override: after a crash, price leads and on-chain usage lags.
  // A 30% 30-day return is too strong to ignore even if addresses haven't caught up.
  const strongMom = mom30 >= 0.30;
  const gateOk = usageUp || strongMom;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'addr>=avg OR mom30>=30%', ok: gateOk, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !gateOk) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
