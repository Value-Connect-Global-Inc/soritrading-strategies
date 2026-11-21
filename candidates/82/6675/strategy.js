/*
 * @coinsori-strategy v1
 * name: On-Chain Adoption Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's price follows real user adoption. When the number of
 * daily active addresses is growing versus its own 30-day average, demand is real and
 * uptrends are more likely to continue; when usage contracts, the market is often
 * topping. This is a demand-side regime filter, not another price oscillator.
 * When it buys and sells: buys when the daily close is above its 200-day average AND
 * active addresses are at least 3% above their 30-day norm. Sells when the close falls
 * back below the 200-day average, or addresses drop 3% below their 30-day norm, or a
 * hard 25% stop below entry is hit.
 * When it does NOT work: in a long sideways market the 200-day average keeps flipping
 * and the strategy pays fees on a few round trips; and if the address data feed stops
 * updating, the strategy stops trading (no data, no signal).
 */
function onUpdate(ctx) {
  const SMA_N = 200;       // long-term trend: 200 x 1d = ~8 months, filters out noise
  const ADOPT_UP = 1.03;   // usage 3% above its 30-day norm = real adoption growth
  const ADOPT_DOWN = 0.97; // usage 3% below its 30-day norm = users leaving
  const STOP = 0.25;       // hard stop below entry; 1d swings are wide, so this is loose
  const SIZE = 0.95;

  const sma = ctx.sma(SMA_N, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma == null || prevClose == null) { ctx.watch([]); return null; }

  // --- on-chain adoption ratio, lagged one day (yesterday's count vs 30d norm) ---
  const addrNow = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  let addrPrev = (ctx.state && typeof ctx.state.addrPrev === 'number') ? ctx.state.addrPrev : null;
  if (addrNow != null) ctx.state.addrPrev = addrNow; // becomes available next bar
  let adopt = null;
  if (addrPrev != null && addrSma != null && addrSma > 0) adopt = addrPrev / addrSma;
  const adoptionUp = adopt != null && adopt >= ADOPT_UP;
  const adoptionDown = adopt != null && adopt <= ADOPT_DOWN;

  const holding = ctx.position > 1e-9;
  const trendUp = prevClose > sma;

  // --- rule 6: declare every entry/exit price every tick ---
  if (holding) {
    const w = [
      { side: 'sell', price: sma, trigger: 'below', note: 'trend break' },
      { side: 'sell', price: sma, trigger: 'below', note: 'adoption exit', conds: [{ label: 'usage<3% below norm', ok: adoptionDown }] }
    ];
    if (ctx.entryPx != null) {
      w.push({ side: 'sell', price: ctx.entryPx * (1 - STOP), trigger: 'below', note: 'hard stop' });
    }
    ctx.watch(w);
  } else {
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'trend up', conds: [{ label: 'usage>3% above norm', ok: adoptionUp }] }]);
  }

  // --- exits (reduce-only, sized from ctx.position) ---
  if (holding) {
    if (!trendUp || adoptionDown) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (ctx.entryPx != null && ctx.price <= ctx.entryPx * (1 - STOP)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // --- entry: only when BOTH the price trend and on-chain demand agree ---
  if (trendUp && adoptionUp) {
    return { side: 'buy', qty: ctx.cash / ctx.price * SIZE };
  }
  return null;
}
