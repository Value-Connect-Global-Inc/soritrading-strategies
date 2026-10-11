/*
 * @coinsori-strategy v1
 * name: Cross-Sectional Momentum Rotation 5-Coin 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto majors show momentum persistence — the coin with
 *   the strongest recent return tends to keep outperforming. Instead of timing
 *   one asset, we hold the single strongest of the five and rotate only when a
 *   new coin is clearly ahead. This is cross-sectional (relative) momentum, a
 *   different family from single-asset trend timing.
 * When it buys and sells: each day every coin publishes its 60-day return; the
 *   coin with the highest return (from the last closed day) is the leader and
 *   is held up to half the account. We switch only when a challenger beats the
 *   holder by at least 5 percentage points, or when the holder's own momentum
 *   turns clearly negative (broad downturn → cash).
 * When it does NOT work: in a broad crash every coin falls together and the
 *   least-bad coin still loses (we sit in cash once momentum is negative, but
 *   the transition lags). In chop where leadership flips, rotation pays fees.
 *   Holding half the account in one altcoin still takes large drawdowns.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  if (!closes || closes.length < 80) return null;
  const prev = closes.at(-2);       // last CLOSED bar
  const prev60 = closes.at(-62);    // 60 bars before it
  if (!Number.isFinite(prev) || !Number.isFinite(prev60) || prev60 <= 0) return null;
  const mom = prev / prev60 - 1;    // 60-day momentum of the closed bar

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
  ctx.state.mom[sym] = { i: ctx.i, m: mom };   // publish for next bar
  if (!leader) return null;

  const pos = ctx.pos(sym);
  const holding = pos > 0;

  if (holding) {
    // Switch only when a challenger is clearly ahead (5pp) or momentum clearly negative.
    const gap = best - mom;
    if (gap > 0.05 || mom < -0.05) return { side: 'sell', qty: pos };
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

  const qty = (ctx.cash / price) * 0.50;   // half the account into the leader
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
