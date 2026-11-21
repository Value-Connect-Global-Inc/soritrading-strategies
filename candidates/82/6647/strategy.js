/*
 * @coinsori-strategy v1
 * name: BTC NDX Risk-On Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Bitcoin and the NASDAQ-100 are both risk assets, so a
 * risk-off turn in equities (NDX below its own long average) usually arrives
 * with crypto weakness too. This strategy keeps the proven 50-day BTC trend
 * signal and only enters longs while NDX is above its own rolling average —
 * a cross-asset regime filter that should skip the worst equity-risk-off
 * stretches without changing the trend edge.
 * When it buys and sells: buys when BTC closes above its 50-day average AND
 * NDX is above its own ~60-day average, sized so one ATR(14) move is ~3% of
 * the account; sells when BTC closes back below the 50-day average.
 * When it does NOT work: if BTC rallies while NDX is still in its own
 * downtrend (decoupling), the filter keeps it flat and it misses the move;
 * in a sideways chop around the BTC average it flips on and off and pays fees.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma300_1 = ctx.sma(300, 1);
  const sma300_2 = ctx.sma(300, 2);
  if (sma300_1 == null || sma300_2 == null || price == null) return null;

  // NDX regime: NDX is risk-on when above its own ~60-day average. NDX is a
  // daily series (repeats on 4h bars), so store only new values in ctx.state.
  const ndx = ctx.data("base.ndx");
  if (ndx == null) return null;

  const st = ctx.state;
  if (!st.ndxHist) st.ndxHist = [];
  if (st.ndxHist.length === 0 || Math.abs(st.ndxHist[st.ndxHist.length - 1] - ndx) > 1e-9) {
    st.ndxHist.push(ndx);
    if (st.ndxHist.length > 260) st.ndxHist.shift();
  }
  const look = Math.min(60, st.ndxHist.length);
  if (look < 60) return null; // need ~60 daily NDX values for a stable average

  let sum = 0;
  for (let i = st.ndxHist.length - look; i < st.ndxHist.length; i++) sum += st.ndxHist[i];
  const ndxAvg = sum / look;
  const riskOn = ndx > ndxAvg;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: sma300_1, trigger: 'below', note: 'below 50-day MA' }]);
    if (close1 < sma300_1) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Vol target: size so one ATR(14) move is ~3% of the account, capped at full
  // and floored at 10% so a single calm bar never over-leverages.
  const atr1 = ctx.atr(14, 1);
  if (atr1 == null || atr1 <= 0) return null;
  const atrPct = atr1 / price;
  const size = Math.min(1, Math.max(0.1, 0.03 / atrPct));

  ctx.watch([{ side: 'buy', price: sma300_1, trigger: 'above', note: 'above 50-day MA, NDX risk-on',
               conds: [{ label: 'NDX above 60d avg', ok: riskOn, closed: true }] }]);
  if (close1 > sma300_1 && close2 <= sma300_2 && riskOn) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * size };
  }
  return null;
}
