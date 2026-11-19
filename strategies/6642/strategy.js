/*
 * @coinsori-strategy v1
 * name: BTC 4H Vol-Targeted 50D Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: A plain trend filter is fully invested in calm and in
 * panic alike, so a crash hits the whole account. This version keeps the same
 * 50-day trend signal but sizes each position by current volatility — a small
 * position when ATR is wide, a full position when it is narrow — so a 1-ATR
 * move is always worth about the same fraction of the account. Same edge,
 * smaller drawdowns.
 * When it buys and sells: buys when the 4h close crosses above the 50-day
 * average, sized inversely to ATR(14); sells when the close crosses below it.
 * When it does NOT work: in a sideways chop around the average it flips on and
 * off and pays fees on both sides; sizing down in a volatile rally also gives
 * back part of the upside.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const sma300_1 = ctx.sma(300, 1);
  const sma300_2 = ctx.sma(300, 2);
  if (sma300_1 == null || sma300_2 == null || price == null) return null;

  const close1 = ctx.closes.at(-2);
  const close2 = ctx.closes.at(-3);
  if (close1 == null || close2 == null) return null;

  if (ctx.position > 0) {
    ctx.watch([{ side: 'sell', price: sma300_1, trigger: 'below', note: 'below 50-day MA' }]);
    if (close1 < sma300_1) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Vol target: size so one ATR(14) move is ~3% of the account, capped at full
  // position and floored at 10% so a single calm bar never over-leverages.
  const atr1 = ctx.atr(14, 1);
  if (atr1 == null || atr1 <= 0) return null;
  const atrPct = atr1 / price;
  const size = Math.min(1, Math.max(0.1, 0.03 / atrPct));

  ctx.watch([{ side: 'buy', price: sma300_1, trigger: 'above', note: 'above 50-day MA' }]);
  if (close1 > sma300_1 && close2 <= sma300_2) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * size };
  }
  return null;
}
