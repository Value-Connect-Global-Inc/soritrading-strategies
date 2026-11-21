/*
 * @coinsori-strategy v1
 * name: BTC Macro Regime NDX Risk-On 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trades as a high-beta risk asset, so its up-trends are
 * far more reliable when broad equity risk appetite (NASDAQ-100) is also rising,
 * and its drawdowns usually start when risk appetite turns. A persistent
 * risk-on/off regime filter from NDX removes the counter-trend entries that pure
 * BTC price filters keep.
 * When it buys and sells: buys when BTC closes above its 200-bar EMA AND the
 * NASDAQ-100 is above its own 60-day mean (risk-on). Sells when BTC closes below
 * its 200-bar EMA or price falls 3x ATR below entry.
 * When it does NOT work: in a bull market with no NDX pullback it slightly
 * underperforms holding due to fees; and in a crypto-only rally while NDX is
 * falling it stays flat and misses the move.
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
  // mean = risk-on. Regime is recomputed once per day from PRIOR days only (no look-ahead).
  const day = Math.floor(ctx.times.at(-1) / 86400);
  let st = ctx.state.ndx || { hist: [], lastDay: 0, riskOn: null };
  const ndx = ctx.data('base.ndx');
  if (ndx != null && day !== st.lastDay) {
    if (st.hist.length >= 30) {
      const m = st.hist.reduce((a, b) => a + b, 0) / st.hist.length;
      st.riskOn = ndx > m; // risk-on only when NDX sits above its own recent mean
    }
    st.hist.push(ndx);
    if (st.hist.length > 60) st.hist.shift();
    st.lastDay = day;
    ctx.state.ndx = st;
  }
  const riskOn = st.riskOn;

  const prevClose = ctx.closes.at(-2);
  const aboveTrend = prevClose != null && prevClose > ema200;
  const belowTrend = prevClose != null && prevClose < ema200;

  const watch = [];

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    let stop = null;
    if (entryPx != null && atr != null) stop = entryPx - 3 * atr; // hard stop: cap crash drawdown
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' });
    watch.push({ side: 'sell', price: ema200, trigger: 'below', note: 'close < EMA200' });
    ctx.watch(watch);
    if (belowTrend) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // flat: enter only on uptrend AND risk-on regime
  watch.push({ side: 'buy', price: ema200, trigger: 'above', note: 'close > EMA200 + risk-on', conds: [
    { label: 'NDX > 60d mean', ok: riskOn === true }
  ]});
  ctx.watch(watch);
  if (aboveTrend && riskOn === true) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
