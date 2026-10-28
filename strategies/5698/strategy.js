/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Trend Ride 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Sustained bull markets are marked by persistent 'greed' — the crowd stays optimistic for a long time, not just one day. Buying when the Fear & Greed index is in the greedy zone (60-85) AND price is above its 200-day average rides a confirmed trend instead of fighting it, unlike a pure mean-reversion (buy-the-dip) approach.
 * When it buys and sells: It buys when the previous day's Fear & Greed reading is between 60 and 85 (greedy but not euphoric) and price closes above the 200-day average. It sells when price closes below the 200-day average, Fear & Greed drops below 45, or price falls 20% below entry as a disaster stop.
 * When it does NOT work: In a slow grinding bull where fear never clears 60, it stays in cash and misses the move. It also exits early if a strong bull briefly dips to 'fear' (F&G < 45) on a pullback, missing the subsequent rally.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const fg = ctx.data("fear_greed");
  if (sma200 == null || fg == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // 60-85 = greedy-but-not-euphoric; 85+ is euphoria (top risk), 45 = sentiment turned bearish
  const greedyZone = fg >= 60 && fg <= 85;

  if (ctx.position > 0) {
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null; // 20% disaster stop
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' },
      { side: 'sell', at: 0, note: 'F&G < 45 exit' }
    ]);
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (fg < 45) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend', conds: [{ label: 'F&G in greedy zone', ok: greedyZone, closed: true }] }
  ]);
  if (greedyZone && prevClose > sma200) {
    // 60% of cash per entry; 20% stop limits account risk to ~12%
    const qty = (0.6 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
