/*
 * @coinsori-strategy v1
 * name: BTC 4H Bollinger MR Uptrend-6pct
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC overshoots down on fear and snaps back, and this only
 * buys dips while price is clearly above its 200-bar average (at least 6% above)
 * so the longer-term trend is up and a dip is a pullback, not a reversal. This
 * is the same recipe validated on ETH 4h, tested here to see if the edge
 * generalizes to BTC.
 * When it buys and sells: it buys when price closes below the 20-bar lower
 * Bollinger band with RSI below 35 AND price at least 6% above the 200-bar
 * average. It sells when price returns to the middle band or RSI climbs above 60.
 * Size is ATR-scaled (risk 2% on a 2-ATR stop).
 * When it does NOT work: BTC trends more than ETH and may not snap back the same
 * way, so it could lose on dips that keep falling. It lags buy-and-hold in
 * strong melt-ups and takes few trades in choppy markets.
 *
 * 2026-04-11: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 추가)
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.closes[ctx.closes.length - 2];
  if (bb == null || bb.lower == null || rsi == null || sma200 == null || atr == null || px == null) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position > 0) {
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', qty: ctx.position, note: 'mid band exit' },
      { side: 'sell', qty: ctx.position, note: 'RSI>60 exit', conds: [{ label: 'RSI(14)', now: rsi, op: '>', ref: 60, closed: true }] }
    ]);
    if (px >= bb.mid || rsi > 60) return { side: 'sell', qty: ctx.position };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower dip', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 35, closed: true },
      { label: 'Close > SMA200*1.06', now: px, op: '>', ref: sma200 * 1.06, closed: true }
    ]}
  ]);

  if (px <= bb.lower && rsi < 35 && px > sma200 * 1.06) {
    const equity = ctx.cash + ctx.position * ctx.price;
    const stopDist = 2 * atr;
    const qty = Math.max(0, Math.min((equity * 0.02) / stopDist, (ctx.cash / ctx.price) * 0.95));
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
