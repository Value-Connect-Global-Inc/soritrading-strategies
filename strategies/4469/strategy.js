/*
 * @coinsori-strategy v1
 * name: Hashrate-Confirmed Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's hashrate (miner computing power) is a slower-moving
 * on-chain signal than active addresses — miners keep building through bear markets.
 * So a hashrate gate should keep us in the early recovery that the active-address
 * gate misses, while still confirming that the network is growing, not shrinking.
 * When it buys and sells: buys when the 30-day price return is positive, the close
 * is above the 200-day EMA, and hashrate is at/above its 30-day average. Sells when
 * the close falls below the 200-day EMA, the 30-day return turns negative, or a 15%
 * hard stop is hit.
 * When it does NOT work: hashrate almost always rises (mining difficulty self-adjusts),
 * so the gate rarely blocks anything and this becomes plain momentum with a stop —
 * which the ledger shows is worse than the active-address-gated champion. It also
 * adds no protection in a bear market where hashrate keeps climbing.
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

  // Hashrate gate: only buy when hashrate is at/above its 30-day average.
  // Missing data → allow (never silently block on missing data).
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  let minersUp = true;
  if (hr != null && hrAvg != null) minersUp = hr >= hrAvg;

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

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'hashrate >= 30d avg', ok: minersUp, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !minersUp) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
