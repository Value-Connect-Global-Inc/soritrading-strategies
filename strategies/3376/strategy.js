/*
 * @coinsori-strategy v1
 * name: Multi-Asset Momentum Rotation 1D
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Cross-sectional momentum is the opposite family to the RSI2
 * panic basket — it buys the STRONGEST asset while it keeps trending and holds cash
 * when every asset is falling. Crypto trends persist: the asset with the best trailing
 * month usually keeps leading, so rotating into it captures the up-legs a dip-buyer ignores.
 * When it buys and sells: Once a week it measures each asset's 30-day return. It holds the
 * single best asset, only when that asset is still above its own 50-day trend line. It sells
 * when that asset loses the top rank, its 30-day return turns negative, or price falls 15%
 * below entry. One asset at a time, full pool, no shorting.
 * When it does NOT work: In a choppy market where leadership flips weekly it churns through
 * fees. In a broad bear everything is negative so it sits in cash and misses the bottom —
 * that is the panic basket's job. A melt-up in the second-best asset is missed.
 */

function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 32) return null;

  // 30-day momentum on CLOSED bars (ago=1 vs ago=31) — no lookahead.
  const mom = closes[n - 2] / closes[n - 32] - 1;

  // 50-day trend on the previous CLOSED bar: leader must be above it to be a momentum buy.
  const sma50 = ctx.sma(50, 1);
  const aboveTrend = sma50 != null && closes[n - 2] > sma50;

  // Publish this asset's momentum + trend stamped with its bar, so every symbol ranks on the
  // SAME completed map from the previous bar (consistent, no double-buy, no lookahead).
  if (!ctx.state.mom) ctx.state.mom = {};
  ctx.state.mom[sym] = { v: mom, i: ctx.i, t: aboveTrend };

  const syms = ctx.syms || [sym];
  let best = null, bestMom = -Infinity, have = 0;
  for (const s2 of syms) {
    const e = ctx.state.mom[s2];
    if (!e || e.i >= ctx.i) continue; // skip this bar's entries — rank on last bar only
    have++;
    if (e.v > bestMom) { bestMom = e.v; best = s2; }
  }
  // Need at least 2 assets ranked to rotate (SOL's history starts later than BTC/ETH).
  if (have < 2 || best == null) return null;

  const pos = ctx.pos(sym);
  const s = ctx.state.s || (ctx.state.s = {});
  const st = s[sym] || (s[sym] = {});

  const isRebalance = (ctx.i % 7 === 0); // weekly rebalance on 1d bars

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stopped = price <= entry * 0.85;
    ctx.watch([{ side: 'sell', price: entry * 0.85, trigger: 'below', note: '15% stop' }]);
    if (stopped) {
      // After a stop, cool down 7 bars so a whipsaw rebound does not re-enter instantly.
      st.coolUntil = ctx.i + 7;
      return { side: 'sell', qty: pos };
    }
    if (isRebalance && (best !== sym || bestMom <= 0)) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (isRebalance && best === sym && bestMom > 0 && ctx.i >= (st.coolUntil || 0)) {
    // TREND GATE: only buy the leader while it is above its own 50-day SMA (closed bar).
    // A leader that already broke its trend is a reversal risk, not a momentum buy.
    const bestEntry = ctx.state.mom[best];
    if (!bestEntry || !bestEntry.t) return null;
    ctx.watch([{ side: 'sell', price: price * 0.85, trigger: 'below', note: '15% stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
