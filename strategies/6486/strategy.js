/*
 * @coinsori-strategy v1
 * name: BTC VIX Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a high-beta risk asset that falls hard when
 * stock-market fear (VIX) spikes. Adding a fear gate to a simple uptrend rule
 * keeps the position out of the worst crash periods, which should cut drawdown
 * versus plain buy-and-hold.
 * When it buys and sells: Buy when the daily close is above the 50-day average
 * AND the VIX is calm (below its own 1-year average). Sell when the close falls
 * back below the 50-day average.
 * When it does NOT work: In a calm-VIX bear market (crypto falls on its own
 * news, not stock fear) the gate does not help and the trend rule alone is
 * exposed. In a VIX spike that recovers within days it exits late and re-enters
 * higher, paying the spread.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  // Rolling VIX stats from PAST values only (no look-ahead): compute from the
  // stored history, then push today's value.
  const vix = ctx.data("base.vix");
  const st = ctx.state;
  if (st.hist == null) st.hist = [];
  let z = null;
  if (vix != null) {
    if (st.hist.length >= 60) {
      let s = 0;
      for (const v of st.hist) s += v;
      const m = s / st.hist.length;
      let ss = 0;
      for (const v of st.hist) ss += (v - m) * (v - m);
      const sd = Math.sqrt(ss / st.hist.length);
      if (sd > 0) z = (vix - m) / sd;
    }
    st.hist.push(vix);
    if (st.hist.length > 260) st.hist.shift();
  }

  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'trend break' }]);
    if (prevClose < sma50) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const trendUp = prevClose > sma50;
  // Entry gate: do not start a long while stock fear is elevated (z >= 0.5 = above its 1y mean).
  const vixCalm = z != null && z < 0.5;
  const buyWatch = { side: 'buy', price: sma50, trigger: 'above', note: 'uptrend + calm VIX' };
  if (z != null) buyWatch.conds = [{ label: 'VIX z-score (1y)', now: z, op: '<', ref: 0.5 }];
  ctx.watch([buyWatch]);
  if (trendUp && vixCalm) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
