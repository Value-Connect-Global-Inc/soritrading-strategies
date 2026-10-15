/*
 * @coinsori-strategy v1
 * name: Hashrate-Confirmed Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same structure as the validated active-address champion, but the
 * confirmation gate uses a DIFFERENT on-chain axis — Bitcoin's network hash rate.
 * Hashrate is miner investment: miners add machines when they expect profit, and
 * capitulate (shut off) when price falls below their cost. So hashrate above its own
 * 30-day average confirms a healthy, invested network; a drop signals miner stress.
 * Hypothesis: buying price momentum only when miners are still investing skips rallies
 * that are already being abandoned by the people who secure the network.
 * When it buys and sells: buys when the 30-day price return is positive, the close is
 * above the 200-day EMA, and hashrate is at/above its 30-day average. Sells when the
 * close falls below the 200-day EMA, the 30-day return turns negative, or a 15% hard
 * stop is hit. Same exit rules and vol-scaled sizing as the champion.
 * When it does NOT work: hashrate has a strong secular uptrend (difficulty ratchets up),
 * so the gate can stay "on" for long stretches and add little filtering; and it reacts
 * slowly to price crashes (miners keep machines running for weeks), so it may not warn
 * early. It also only checks BTC, so it adds no protection to other coins.
 * NOTE (diagnostic): this build REQUIRES hashrate data — if ctx.data returns null the
 * strategy does nothing. Used to verify the dataset is actually loaded on the agent.
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

  // Miner-health gate: only buy when hashrate is at/above its 30-day average.
  // DIAGNOSTIC: require the data — if missing, do nothing (proves it is loaded).
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  if (hr == null || hrAvg == null) return null;
  const hrOk = hr >= hrAvg;

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
                       { label: 'hashrate >= 30d avg', ok: hrOk, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !hrOk) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
