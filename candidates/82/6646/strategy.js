/*
 * @coinsori-strategy v1
 * name: BTC VIX-Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: Crypto crashes usually arrive together with a spike in
 * stock volatility (VIX), which marks a risk-off regime. This strategy rides
 * the BTC trend while volatility is calm, refuses to START a new position
 * when VIX is far above its own recent average, and sizes every position by
 * current BTC volatility so a wide-ATR (choppy) regime risks less capital.
 * When it buys and sells: buys when BTC closes above its 50-day average AND
 * the VIX z-score is below 1.5 (calm), sized so one ATR(14) move is ~3% of
 * the account; sells when BTC closes back below the 50-day average.
 * When it does NOT work: in a calm but sideways market it flips on and off
 * around the average and pays fees; if a crash starts while VIX is still low
 * and only spikes after, the 2-day data lag lets the position ride down.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma300_1 = ctx.sma(300, 1);
  const sma300_2 = ctx.sma(300, 2);
  if (sma300_1 == null || sma300_2 == null || price == null) return null;

  // VIX regime: rolling z-score of the lagged VIX level vs its own recent mean.
  const vix = ctx.data("base.vix");
  if (vix == null) return null;

  const st = ctx.state;
  if (!st.vixHist) st.vixHist = [];
  // VIX is a daily series: on 4h bars the same value repeats, so keep only
  // new values to build a stable rolling mean without 6x duplicates.
  if (st.vixHist.length === 0 || Math.abs(st.vixHist[st.vixHist.length - 1] - vix) > 1e-9) {
    st.vixHist.push(vix);
    if (st.vixHist.length > 60) st.vixHist.shift();
  }
  if (st.vixHist.length < 20) return null; // need enough history for a stable mean

  let sum = 0;
  for (let i = 0; i < st.vixHist.length; i++) sum += st.vixHist[i];
  const mean = sum / st.vixHist.length;
  let sq = 0;
  for (let i = 0; i < st.vixHist.length; i++) sq += (st.vixHist[i] - mean) * (st.vixHist[i] - mean);
  const sd = Math.sqrt(sq / st.vixHist.length);
  const vixZ = sd > 0 ? (vix - mean) / sd : 0;

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

  ctx.watch([{ side: 'buy', price: sma300_1, trigger: 'above', note: 'above 50-day MA, VIX calm',
               conds: [{ label: 'VIX z-score', now: vixZ, op: '<', ref: 1.5, closed: true }] }]);
  if (close1 > sma300_1 && close2 <= sma300_2 && vixZ < 1.5) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * size };
  }
  return null;
}
