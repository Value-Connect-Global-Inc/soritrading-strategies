/*
 * @coinsori-strategy v1
 * name: Onchain Demand Confirmed-Exit BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same on-chain demand signal as the validated 30-bar
 * baseline (rising smoothed active-address count = hold BTC), but with a
 * CONFIRMED exit: sell only after 2 consecutive falling bars instead of the
 * first one. Hypothesis: the baseline's single-bar exit whipsaws in choppy
 * regimes (2021+), and a confirmation reduces churn and drawdown.
 * When it buys and sells: buys when smoothed demand rises vs ~30 days ago;
 * sells after 2 consecutive clearly-falling readings.
 * When it does NOT work: requiring confirmation holds through sharper demand
 * turnarounds, so it can give back more in fast regime changes; if demand
 * falls in a straight line the confirmation only delays the exit slightly.
 * On-chain data is live in the feed (verified).
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  ctx.watch([]); // no price/time condition — pure on-chain signal

  const pos = ctx.position;

  const raw = ctx.data('addr_sma30');
  const now = Number(raw);
  if (!Number.isFinite(now) || now <= 0) return null;

  const hist = ctx.state.hist || [];
  hist.push(now);
  if (hist.length > 30) hist.shift();
  ctx.state.hist = hist;
  if (hist.length < 30) return null;
  const past = hist[0]; // ~29 bars ago

  const rising = now > past * 1.005;
  const falling = now < past * 0.995;

  // Confirmed exit: require 2 consecutive falling bars before selling.
  ctx.state.down = ctx.state.down || 0;
  ctx.state.down = falling ? ctx.state.down + 1 : 0;

  if (pos > 0) {
    if (ctx.state.down >= 2) return { side: 'sell', qty: pos };
    return null;
  }
  if (rising) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
