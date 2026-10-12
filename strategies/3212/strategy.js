/*
 * @coinsori-strategy v1
 * name: Liquidation Capitulation Reversal 4H
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: a spike in long liquidations means leverage longs were
 * force-sold into falling prices — often the last sellers of a local bottom.
 * Buying that capitulation and selling the bounce is a sentiment reversal,
 * a completely different family from the 1D momentum champion.
 * When it buys and sells: buy when the last 24 bars (4 days) of liquidation
 * flow are > 2.5x the previous 24 bars. Sell at +8% take-profit, -4% stop,
 * or after 48 bars (8 days). Half of equity per trade.
 * When it does NOT work: in a prolonged bear market every capitulation is a
 * falling knife and the bounce never comes — this loses there, hard.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const cur = ctx.binanceLiqs(24);
  const prev48 = ctx.binanceLiqs(48);
  if (cur == null || prev48 == null) {
    ctx.watch([]);
    return null;
  }
  const prev = prev48 - cur;
  const pos = ctx.position;
  const st = ctx.state || {};
  const px = ctx.price;

  if (pos > 0) {
    const entry = st.entry || ctx.entryPx || px;
    const pnl = px / entry - 1;
    // TP 8% / stop -4% / time exit 48 bars — all tuned to a short bounce
    ctx.watch([
      { side: 'sell', price: +(entry * 1.08).toFixed(2), trigger: 'above', note: 'TP +8%' },
      { side: 'sell', price: +(entry * 0.96).toFixed(2), trigger: 'below', note: 'SL -4%' }
    ]);
    if (pnl >= 0.08 || pnl <= -0.04 || (ctx.i - (st.bar || ctx.i)) >= 48) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // No position: entry is a liquidation-flow spike, not a price/time level.
  ctx.watch([]);
  // 2.5x spike over the previous 4 days = capitulation
  if (prev > 0 && cur > prev * 2.5) {
    ctx.state = { entry: px, bar: ctx.i };
    return { side: 'buy', qty: ctx.cash / px * 0.5 };
  }
  return null;
}
