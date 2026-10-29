/*
 * @coinsori-strategy v1
 * name: SOL Fear-Greed Trend Ride 1D
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Generalization test of the validated BTC Fear-Greed trend edge: sustained bull
 * markets are marked by persistent 'greed', so buying in the greedy zone (60-85) while price holds
 * above its 200-day average rides a confirmed trend. If the same mechanism works on SOL, the edge
 * is not BTC-specific.
 * When it buys and sells: Buys when the previous day's Fear & Greed reading is 60-85 and SOL closes
 * above its 200-day average. Sells when SOL closes below the 200-day average, Fear & Greed collapses
 * below 25 (capitulation), or price falls 20% below entry as a disaster stop.
 * When it does NOT work: In a slow grinding bull where greed never clears 60 it stays in cash and
 * misses the move. SOL is far more volatile than BTC, so the 20% disaster stop is the real
 * protection in fast crashes.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const fg = ctx.data("fear_greed");
  if (sma200 == null || fg == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // 60-85 = greedy-but-not-euphoric; 85+ is euphoria (top risk); 25 = extreme fear (capitulation)
  const greedyZone = fg >= 60 && fg <= 85;

  if (ctx.position > 0) {
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null; // 20% disaster stop
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' }
    ]);
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (fg < 25) return { side: 'sell', qty: ctx.position, reduceOnly: true }; // extreme fear = conviction broken
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
