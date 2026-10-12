/*
 * @coinsori-strategy v1
 * name: BTC 1D Donchian Breakout with ATR Trailing Stop
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 * 2025-04-11 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: Classic channel breakout trend-following. When price breaks above
 * the highest point of the last 20 days, a new uptrend is usually starting; when it
 * breaks below the recent low, the trend is ending. This catches sustained moves.
 * When it buys and sells: Buys when the price exceeds the 20-day high. Sells when the
 * close falls below the 10-day low or price drops more than 3 ATR from the entry.
 * When it does NOT work: It whipsaws in sideways/choppy markets where price pokes above
 * and below the channel without a real trend, and it can give back gains on sharp
 * reversals. It is a pure trend follower — it loses when there is no trend.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) {
    ctx.watch([]);
    return null;
  }

  // Donchian breakout: current price above the 20-day high (closed bars, no lookahead).
  const hi20 = ctx.high(20, 1);
  const lo10 = ctx.low(10, 1);
  if (hi20 == null || lo10 == null) {
    ctx.watch([]);
    return null;
  }

  const atr = ctx.atr(14, 1);
  if (atr == null) {
    ctx.watch([]);
    return null;
  }

  if (ctx.position <= 0) {
    ctx.watch([{ side: 'buy', price: hi20, trigger: 'above', note: '20d high breakout' }]);
    if (px > hi20) {
      ctx.state.entryPx = px;
      return { side: 'buy', qty: (ctx.cash / px) * 0.99 };
    }
    return null;
  }

  // Trailing stop: exit if price breaks the 10-day low OR drops 3 ATR below entry.
  const entry = ctx.state.entryPx != null ? ctx.state.entryPx : ctx.entryPx;
  const stop = entry != null ? entry - 3 * atr : null;
  const watches = [];
  if (stop != null) {
    watches.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' });
  }
  watches.push({ side: 'sell', price: lo10, trigger: 'below', note: '10d low exit' });
  ctx.watch(watches);

  if (px < lo10 || (stop != null && px < stop)) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
