/*
 * @coinsori-strategy v1
 * name: BTC NDX Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a high-beta tech stock — it tends
 * to rise when the stock market (NASDAQ-100) is in an uptrend and fall when
 * equities roll over. Gating a simple uptrend rule on the NDX trend keeps
 * the position out of risk-off periods that hit both markets at once.
 * When it buys and sells: Buy when the daily close is above the 50-day
 * average AND the NASDAQ-100 is above its own 200-day average (risk-on).
 * Sell when the close falls back below the 50-day average.
 * When it does NOT work: When crypto decouples from equities (crypto-only
 * rallies or crashes on its own news), the NDX gate adds nothing or blocks
 * valid entries. In a choppy market the 50-day trend rule whipsaws and pays
 * fees on false breakouts.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) { ctx.watch([]); return null; }

  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) { ctx.watch([]); return null; }

  // NDX regime from PAST values only (no look-ahead): rolling 200-day mean.
  const ndx = ctx.data("base.ndx");
  const st = ctx.state;
  if (st.hist == null) st.hist = [];
  let ndxUp = null;
  if (ndx != null) {
    if (st.hist.length >= 200) {
      let s = 0;
      for (const v of st.hist) s += v;
      ndxUp = ndx > s / st.hist.length;
    }
    st.hist.push(ndx);
    if (st.hist.length > 260) st.hist.shift();
  }

  const pos = ctx.position || 0;
  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'trend break' }]);
    if (prevClose < sma50) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const trendUp = prevClose > sma50;
  // Entry gate: only start a long while equities are in an uptrend (risk-on).
  const gateOk = ndxUp === true;
  const buyWatch = { side: 'buy', price: sma50, trigger: 'above', note: 'uptrend + NDX risk-on' };
  if (ndxUp != null) buyWatch.conds = [{ label: 'NDX above 200d avg', ok: ndxUp }];
  ctx.watch([buyWatch]);
  if (trendUp && gateOk) {
    const qty = (ctx.cash / ctx.price) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
