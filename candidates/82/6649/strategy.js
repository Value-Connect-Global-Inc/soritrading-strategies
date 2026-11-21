/*
 * @coinsori-strategy v1
 * name: SOL 4H Vol-Targeted 50D Trend
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: The recipe validated on BTC 4h — a 50-day trend filter
 * with positions sized by current volatility — applied to SOL. Altcoins trend
 * harder than BTC, so a slow trend filter plus ATR sizing rides SOL's bigger
 * moves while a wide-ATR (choppy) regime risks less capital. The risk target
 * is 8% per ATR: SOL's normal volatility is roughly twice BTC's, and the
 * earlier 5% target left the position under-invested (50-60%) exactly when
 * SOL trends hardest, so the target is raised to capture more of the trend
 * while the trend filter still cuts the crash.
 * When it buys and sells: buys when the 4h close crosses above the 50-day
 * average, sized so one ATR(14) move is ~8% of the account; sells when the
 * close crosses back below the 50-day average.
 * When it does NOT work: in a sideways chop around the average it flips on
 * and off and pays fees on both sides; SOL is more volatile than BTC, so in
 * a violent crash the trend exit lags and the drawdown is deeper than BTC's.
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

  // Vol target: size so one ATR(14) move is ~8% of the account (raised from 5%
  // so the position stays fully invested during SOL's strong trends, where the
  // earlier target forced 50-60% exposure), capped at full and floored at 10%.
  const atr1 = ctx.atr(14, 1);
  if (atr1 == null || atr1 <= 0) return null;
  const atrPct = atr1 / price;
  const size = Math.min(1, Math.max(0.1, 0.08 / atrPct));

  ctx.watch([{ side: 'buy', price: sma300_1, trigger: 'above', note: 'above 50-day MA' }]);
  if (close1 > sma300_1 && close2 <= sma300_2) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * size };
  }
  return null;
}
