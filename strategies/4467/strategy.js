/*
 * @coinsori-strategy v1
 * name: Dual On-Chain Confirmed Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A Bitcoin rally is more likely to be real when TWO independent
 * on-chain metrics confirm it at the same time — network usage (active addresses)
 * AND mining power (hashrate) are both growing. One metric can be noisy; two
 * agreeing is a stronger signal than either alone.
 * When it buys and sells: buys when the 30-day price return is positive, the close
 * is above the 200-day EMA, active addresses are at/above their 30-day average AND
 * hashrate is at/above its 30-day average. Sells when the close falls below the
 * 200-day EMA, the 30-day return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: in the early phase of a bull market right after a crash
 * BOTH metrics are still low, so the double gate is even slower to re-enter than a
 * single gate — it can miss the first leg of a recovery. And it is BTC-only: the
 * gate confirms Bitcoin's own network, so it adds no protection to other coins.
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

  // Dual on-chain gate: BOTH usage and mining power must be at/above their 30-day
  // average. If either dataset is missing on a bar, fall back to the other one
  // (never silently block the whole strategy on a single missing series).
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;
  let miningUp = true;
  if (hr != null && hrAvg != null) miningUp = hr >= hrAvg;
  const confirmed = usageUp && miningUp;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'addr >= 30d avg', ok: usageUp, closed: true },
                       { label: 'hashrate >= 30d avg', ok: miningUp, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !confirmed) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
