/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout 4H
 * ex: binanceusdm
 * syms: BTCUSDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: BTC often trends for days on the 4h chart once it clears a multi-week range;
 * a Donchian breakout catches the start of those trends.
 * When it buys and sells: buys when the previous closed bar breaks above the 20-bar high; sells
 * when it breaks below the 10-bar low (tight trailing exit).
 * When it does NOT work: choppy sideways markets produce false breakouts and whipsaw losses.
 *
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로 (ctx.watch 선언 추가)
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) {
    ctx.watch([]);
    return null;
  }

  const h20 = ctx.high(20, 2); // highest high of the 20 bars before the last closed bar
  const l10 = ctx.low(10, 2);  // lowest low of the 10 bars before the last closed bar
  if (h20 == null || l10 == null) {
    ctx.watch([]);
    return null;
  }

  const prevClose = ctx.closes[1];

  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: l10, trigger: 'below', note: 'exit on 4h close < 10-bar low' }]);
    if (prevClose < l10) return { side: 'sell', qty: ctx.position };
    return null;
  }

  ctx.watch([{ side: 'buy', price: h20, trigger: 'above', note: 'entry on 4h close > 20-bar high' }]);
  if (prevClose > h20) return { side: 'buy', qty: ctx.cash / px * 0.99 };
  return null;
}
