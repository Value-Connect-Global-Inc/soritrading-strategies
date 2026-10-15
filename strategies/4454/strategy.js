/*
 * @coinsori-strategy v1
 * name: Hashrate-Gated Multi-Asset Momentum 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto rallies are healthier when the Bitcoin network is
 * growing — rising mining power (hashrate) means more real machines securing
 * the chain, a slow-moving sign of long-term commitment rather than hype. This
 * strategy runs the same absolute-momentum rule on three majors as the champion,
 * but the whole basket is only allowed to hold when Bitcoin's hashrate is above
 * its own 30-day average (network healthy). It sits in cash when the network is
 * shrinking, which tends to line up with bear markets.
 * When it buys and sells: a leg buys when the previous close is above the 200-day
 * EMA, its 30-day return is positive, AND the hashrate gate is open. It sells when
 * the close drops below the 200-day EMA, the 30-day return turns negative, the 15%
 * hard stop is hit, or the hashrate gate closes.
 * When it does NOT work: in a choppy market where the 30-day return flips sign it
 * whipsaws; the hashrate gate can keep it out of the very start of a fast recovery
 * (hashrate lags price); and all crypto majors are correlated, so a broad crash
 * still hits every held leg.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Network-health gate: Bitcoin hashrate above its own 30-day average.
  // Unknown data = do nothing (never force a trade on a missing signal).
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  if (hr == null || hrAvg == null) return null;
  const networkHealthy = hr > hrAvg;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  // 30-day absolute momentum of the last CLOSED bar
  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  // volatility targeting: size each leg to ~2% daily vol so no coin dominates
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop: 15% below entry
    if (!networkHealthy || price <= stop || prevClose < ema200 || mom30 < 0) {
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                         { label: 'network healthy', ok: networkHealthy, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'network healthy', ok: networkHealthy, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !networkHealthy) return null;

  const targetCash = ctx.cash * 0.33 * volScale;   // 1/3 of pool, scaled by volatility
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
