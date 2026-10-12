/*
 * @coinsori-strategy v1
 * name: ETH 4H Bollinger MR Volume-Flush
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ETH dips to the lower Bollinger band snap back only when the
 * drop is a high-volume capitulation flush (panic sellers exhausted). A quiet
 * low-volume drift down to the band is more likely a falling knife that keeps
 * going. Requiring above-average volume on the dip bar filters out the quiet
 * drifts that caused losses in the choppy 2022-24 period.
 * When it buys and sells: it buys when price closes below the 20-bar lower
 * Bollinger band with RSI below 35, price above the 200-bar average, AND the
 * bar's volume above its average. It sells when price returns to the middle band
 * or RSI climbs above 60. Position size scales with how far price fell.
 * When it does NOT work: in a strong melt-up it sits in cash and lags buy-and-hold
 * (defensive by design). If dips rarely come on high volume it trades little. In a
 * violent crash below the 200-bar average it stays out entirely.
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  const vol = ctx.volumes[ctx.volumes.length - 2];
  const avgVol = ctx.avgVol(20);
  if (bb == null || bb.lower == null || rsi == null || sma200 == null || atr == null || px == null) {
    ctx.watch([]);
    return null;
  }
  if (vol == null || avgVol == null || avgVol <= 0) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position > 0) {
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'BB mid close exit' },
      { side: 'sell', note: 'RSI > 60 close', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }] }
    ]);
    if (px >= bb.mid || rsi > 60) return { side: 'sell', qty: ctx.position };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower close entry', conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 35, closed: true },
        { label: 'PX > SMA200', now: px, op: '>', ref: sma200, closed: true },
        { label: 'Vol > AvgVol', now: vol, op: '>', ref: avgVol, closed: true }
    ]}
  ]);

  // Volume confirmation: only buy a high-volume capitulation flush, not a quiet
  // drift down (the quiet drift is the falling knife that lost money in 2022-24).
  if (px <= bb.lower && rsi < 35 && px > sma200 && vol > avgVol) {
    const equity = ctx.cash + ctx.position * ctx.price;
    const bandDist = Math.max(bb.mid - bb.lower, atr);
    const qty = Math.max(0, Math.min((equity * 0.04) / bandDist, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
