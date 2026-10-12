/*
 * @coinsori-strategy v1
 * name: FearGreedTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: long-term uptrends in BTC are real, but buying into euphoric
 * tops (Fear & Greed above ~75) is where most money is lost. This strategy rides
 * confirmed uptrends and uses the sentiment index only to avoid chasing euphoria.
 * When it buys and sells: buys when price is above both the 200-day and 50-day
 * averages AND Fear & Greed is below 75 (not euphoric). Sells when price closes below
 * the 50-day average (momentum broken) or when Fear & Greed exceeds 88 (extreme greed).
 * When it does NOT work: long bear markets (stays in cash, misses the bottom) and
 * fast V-shaped recoveries where price jumps above the averages so quickly that entries
 * are late and the 50-day exit cuts the move short.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fear_greed');
  const s200 = ctx.sma(200, 1);
  const s50 = ctx.sma(50, 1);
  if (fg == null || s200 == null || s50 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const price = ctx.price;

  if (ctx.position <= 0) {
    // Entry: confirmed uptrend (200d + 50d) and NOT euphoric (fg<75).
    if (prevClose > s200 && prevClose > s50 && fg < 75) {
      ctx.watch([
        { side: 'sell', price: s50, trigger: 'below', note: 'momentum break' },
        { side: 'sell', price: price * 1.5, trigger: 'above', note: 'profit target' }
      ]);
      return { side: 'buy', qty: (ctx.cash * 0.5) / price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'trend entry', conds: [
      { label: 'Close > SMA200', ok: prevClose > s200, closed: true },
      { label: 'Close > SMA50', ok: prevClose > s50, closed: true },
      { label: 'Fear-Greed < 75', now: fg, op: '<', ref: 75, closed: true }
    ] }]);
    return null;
  }

  // Exit on momentum break below SMA50 or extreme greed (fg>=88).
  if (prevClose < s50 || fg >= 88) {
    ctx.watch([]);
    return { side: 'sell', qty: ctx.position };
  }
  ctx.watch([
    { side: 'sell', price: s50, trigger: 'below', note: 'momentum break' },
    { side: 'sell', price: ctx.entryPx * 1.5, trigger: 'above', note: 'profit target' }
  ]);
  return null;
}
