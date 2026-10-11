/*
 * @coinsori-strategy v1
 * name: Cross-Sectional Momentum Rotation 5-Coin 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto majors show momentum persistence — the coin with
 *   the strongest 30-day return tends to keep outperforming. Instead of timing
 *   one asset, we hold the single strongest of the five and rotate when the
 *   leader changes. This is cross-sectional (relative) momentum, a different
 *   family from single-asset trend timing.
 * When it buys and sells: each day every coin publishes its 30-day return; the
 *   coin with the highest return (from the last closed day) is the leader and
 *   is held near-full. We sell when a coin is no longer the leader or when the
 *   leader's own 30-day return turns negative (broad downturn → cash).
 * When it does NOT work: in a broad crash every coin falls together and the
 *   least-bad coin still loses (we sit in cash once all momentum is negative,
 *   but the transition lags). In chop where leadership flips daily, rotation
 *   pays fees and buys the top by accident. A single-asset melt-up (e.g. BTC
 *   alone) is captured, but a laggard-led rally is missed.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  if (!closes || closes.length < 40) return null;
  const prev = closes.at(-2);       // last CLOSED bar
  const prev30 = closes.at(-32);    // 30 bars before it
  if (!Number.isFinite(prev) || !Number.isFinite(prev30) || prev30 <= 0) return null;
  const mom = prev / prev30 - 1;    // 30-day momentum of the closed bar

  if (!ctx.state.mom) ctx.state.mom = {};
  const syms = ctx.syms || [sym];

  // Leader from the COMPLETE previous-bar snapshot (read before overwriting self).
  let leader = null, best = -Infinity;
  for (const s of syms) {
    const e = ctx.state.mom[s];
    if (e && e.i === ctx.i - 1 && Number.isFinite(e.m)) {
      if (e.m > best) { best = e.m; leader = s; }
    }
  }

  // Publish this leg's momentum for the CURRENT bar (readers use it next bar).
  ctx.state.mom[sym] = { i: ctx.i, m: mom };
  if (!leader) return null;   // snapshot not complete yet

  const pos = ctx.pos(sym);
  const holding = pos > 0;

  if (holding) {
    if (sym !== leader || mom < 0) return { side: 'sell', qty: pos };
    return null;
  }

  if (sym !== leader) return null;
  if (best <= 0) return null;       // even the strongest is falling → stay in cash
  let someoneElseHolds = false;
  for (const s of syms) {
    if (s === sym) continue;
    const p = ctx.pos(s);
    if (p > 0) { someoneElseHolds = true; break; }
  }
  if (someoneElseHolds) return null;  // wait for the old leader to exit first

  const qty = (ctx.cash / price) * 0.9;   // near-full into the leader
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
