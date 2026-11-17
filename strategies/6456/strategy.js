/*
 * @coinsori-strategy v1
 * name: BTC Regime Filter (Trend + VIX De-risk) 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC's long-run direction is up, so the benchmark (holding)
 * is hard to beat on raw return. The edge comes from de-risking at the right
 * times: when price breaks below its long-term trend (EMA200 on 4h, ~33 days)
 * or when the stock market's VIX spikes to an extreme (panic that historically
 * drags BTC down). We stay long the rest of the time to ride the bull.
 * When it buys and sells: buy when price closes above a 3% band over EMA200 and
 * the VIX is calm (z-score < 1.5). Sell when price closes below a 1.5% band
 * under EMA200 or the VIX z-score > 2.5. The asymmetric bands exit crashes
 * promptly but re-enter only on strong confirmation, cutting drawdown.
 * When it does NOT work: in a long sideways chop around EMA200 it pays fees on
 * whipsaws; and in a bull with no sustained VIX spikes it slightly underperforms
 * pure holding due to fees.
 */
function onUpdate(ctx) {
  const ema200 = ctx.ema(200, 1);
  const vix = ctx.data("base.vix");
  if (ema200 == null) {
    ctx.watch([]);
    return null;
  }

  // Rolling daily VIX history for z-score (how unusual fear is TODAY vs recent
  // 120 days), instead of trusting a fixed number like "30".
  const day = Math.floor(ctx.times.at(-1) / 86400);
  let st = ctx.state.vix || { hist: [], lastDay: 0 };
  if (vix != null && day !== st.lastDay) {
    st.hist.push(vix);
    if (st.hist.length > 120) st.hist.shift();
    st.lastDay = day;
    ctx.state.vix = st;
  }
  let vixZ = null;
  if (vix != null && st.hist.length >= 30) {
    const mean = st.hist.reduce((a, b) => a + b, 0) / st.hist.length;
    const sd = Math.sqrt(st.hist.reduce((a, b) => a + (b - mean) * (b - mean), 0) / st.hist.length);
    vixZ = sd > 0 ? (vix - mean) / sd : 0;
  }

  const price = ctx.price;
  const pos = ctx.position || 0;
  const prevClose = ctx.closes.at(-2);
  // Asymmetric hysteresis: wide entry band (1.03) = only buy on strong uptrend;
  // tight exit band (0.985) = leave early when the trend starts breaking, which
  // is what keeps drawdowns small during crashes.
  const aboveTrend = prevClose != null && prevClose > ema200 * 1.03;
  const belowTrend = prevClose != null && prevClose < ema200 * 0.985;
  const watch = [];

  if (pos > 0) {
    const conds = [];
    if (vixZ != null) conds.push({ label: 'VIX z-score', now: vixZ, op: '>', ref: 2.5 });
    watch.push({ side: 'sell', price: ema200 * 0.985, trigger: 'below', note: 'close < EMA200 band', conds: conds });
    ctx.watch(watch);
    const vixExit = vixZ != null && vixZ > 2.5;
    if (belowTrend || vixExit) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const calm = vixZ == null || vixZ < 1.5;
  const conds = [
    { label: 'close > EMA200+3%', ok: aboveTrend },
    { label: 'VIX z-score < 1.5', ok: calm }
  ];
  watch.push({ side: 'buy', price: ema200 * 1.03, trigger: 'above', note: 'close above EMA200 band + calm VIX', conds: conds });
  ctx.watch(watch);
  if (aboveTrend && calm) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
