/*
 * @coinsori-strategy v1
 * name: Volatility Squeeze Breakout (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Markets alternate between quiet (low volatility) and
 * explosive (high volatility) phases. When Bollinger Band width collapses to
 * its tightest level in ~100 days, energy is building for a move; buying the
 * first close above the upper band rides the expansion. A different family from
 * trend-following (no SMA direction) and mean reversion (buys strength, not
 * weakness).
 * When it buys and sells: buys when band width is the tightest in 100 days and
 * the close then breaks above the upper band. Sells when the close falls back
 * below the middle band, or a 25% hard stop is hit.
 * When it does NOT work: in a persistent downtrend the squeeze resolves
 * downward and the breakout buy gets stopped out repeatedly; in a long quiet
 * market squeezes fire often with no real move, churning fees.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 130) return null; // 100-bar width history + BB warmup

  const bb = ctx.bb(20, 2, 1); // closed-bar bands
  if (bb == null || bb.upper == null || bb.lower == null || bb.mid == null) return null;
  if (bb.mid <= 0) return null;
  const width = (bb.upper - bb.lower) / bb.mid; // normalized band width

  // rolling width history to find the 100-day minimum
  const st = ctx.state;
  if (!st.widths) st.widths = [];
  st.widths.push(width);
  if (st.widths.length > 101) st.widths.shift();
  if (st.widths.length < 101) return null;

  let minPrev = Infinity;
  for (let i = 0; i < st.widths.length - 1; i++) {
    if (st.widths[i] < minPrev) minPrev = st.widths[i];
  }
  const squeeze = width < minPrev; // tightest in 100 days
  if (squeeze) st.squeezeAge = 0; else if (st.squeezeAge != null) st.squeezeAge++;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75; // hard stop 25% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = closes[n - 2];
    if (prevClose < bb.mid) return { side: 'sell', qty: pos }; // back to middle band
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% stop' },
               { side: 'sell', price: bb.mid, trigger: 'below', note: 'exit: <mid band',
                 conds: [{ label: 'close vs mid band', ok: prevClose >= bb.mid, closed: true }] }]);
    return null;
  }

  // buy only within a few bars after a squeeze, on a close above the upper band
  const fresh = st.squeezeAge != null && st.squeezeAge <= 3;
  const prevClose = closes[n - 2];
  const breakout = fresh && prevClose > bb.upper;
  ctx.watch([{ side: 'buy', price: bb.upper, trigger: 'above', note: 'squeeze breakout',
               conds: [{ label: 'squeeze <= 3 bars ago', ok: fresh, closed: true },
                       { label: 'close > upper band', ok: prevClose > bb.upper, closed: true }] }]);
  if (!breakout) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
