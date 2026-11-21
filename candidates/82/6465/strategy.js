/*
 * @coinsori-strategy v1
 * name: BTC NDX-Regime Directional Long/Short 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trades as a high-beta risk asset that follows broad
 * equity risk appetite (NASDAQ-100). When NDX sits above its own 60-day mean
 * (risk-on) BTC up-trends are reliable, and when NDX is below (risk-off) BTC
 * down-trends are reliable too. The regime gate removes the counter-trend flips
 * that pure price long/short filters make.
 * When it buys and sells: goes LONG when BTC closes above its 200-bar EMA AND
 * NDX is risk-on; goes SHORT when BTC closes below its 200-bar EMA AND NDX is
 * risk-off. Exits when the trend or the regime flips against it, or on a 3x ATR
 * hard stop from entry.
 * When it does NOT work: in a choppy range with no clear NDX regime it flips
 * repeatedly and pays fees; and a crypto-only move against the equity regime is
 * missed entirely.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position || 0;
  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) {
    ctx.watch([]);
    return null;
  }
  const atr = ctx.atr(14, 1);

  // --- NDX risk-on/off regime (daily data, 2-day lag): NDX above its own 60-day
  // mean = risk-on. Recomputed once per day from PRIOR days only (no look-ahead).
  const day = Math.floor(ctx.times.at(-1) / 86400);
  let st = ctx.state.ndx || { hist: [], lastDay: 0, riskOn: null };
  const ndx = ctx.data('base.ndx');
  if (ndx != null && day !== st.lastDay) {
    if (st.hist.length >= 30) {
      const m = st.hist.reduce((a, b) => a + b, 0) / st.hist.length;
      st.riskOn = ndx > m;
    }
    st.hist.push(ndx);
    if (st.hist.length > 60) st.hist.shift();
    st.lastDay = day;
    ctx.state.ndx = st;
  }
  const riskOn = st.riskOn; // true | false | null (unknown during warm-up)

  const prevClose = ctx.closes.at(-2);
  const aboveTrend = prevClose != null && prevClose > ema200;
  const belowTrend = prevClose != null && prevClose < ema200;

  // stop distance from entry: 3x ATR caps a single bad trade
  let stopDist = null;
  if (atr != null) stopDist = 3 * atr;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    let stop = null;
    if (entryPx != null && stopDist != null) stop = entryPx - stopDist;
    const watch = [];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'long ATR stop' });
    watch.push({ side: 'sell', price: ema200, trigger: 'below', note: 'long trend/regime exit', conds: [
      { label: 'NDX risk-off', ok: riskOn === false }
    ]});
    ctx.watch(watch);
    if (belowTrend || riskOn === false) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (pos < 0) {
    const entryPx = ctx.entryPx;
    let stop = null;
    if (entryPx != null && stopDist != null) stop = entryPx + stopDist;
    const watch = [];
    if (stop != null) watch.push({ side: 'buy', price: stop, trigger: 'above', note: 'short ATR stop' });
    watch.push({ side: 'buy', price: ema200, trigger: 'above', note: 'short trend/regime exit', conds: [
      { label: 'NDX risk-on', ok: riskOn === true }
    ]});
    ctx.watch(watch);
    if (aboveTrend || riskOn === true) return { side: 'buy', qty: -pos, reduceOnly: true };
    if (stop != null && price >= stop) return { side: 'buy', qty: -pos, reduceOnly: true };
    return null;
  }

  // flat: long only in risk-on uptrend, short only in risk-off downtrend
  ctx.watch([
    { side: 'buy', price: ema200, trigger: 'above', note: 'long: >EMA200 + risk-on', conds: [
      { label: 'NDX > 60d mean', ok: riskOn === true }
    ]},
    { side: 'sell', price: ema200, trigger: 'below', note: 'short: <EMA200 + risk-off', conds: [
      { label: 'NDX < 60d mean', ok: riskOn === false }
    ]}
  ]);
  if (aboveTrend && riskOn === true) return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  if (belowTrend && riskOn === false) return { side: 'sell', qty: (ctx.cash / price) * 0.95 };
  return null;
}
