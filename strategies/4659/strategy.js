/*
 * @coinsori-strategy v1
 * name: XRP FearGreed Contrarian 1D
 * ex: binance
 * syms: XRP/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index is a daily sentiment gauge
 * (0 = extreme fear, 100 = extreme greed). Crowds are most wrong at the extremes:
 * buying when everyone is terrified (F&G <= 20) and selling when everyone is
 * euphoric (F&G >= 60) harvests the recovery that follows panic. This is a
 * mean-reversion bet on sentiment, the opposite family from trend-following.
 * When it buys and sells: buy on the first daily bar where Fear & Greed is 20 or
 * below (extreme fear). Sell when Fear & Greed climbs back to 60 or above
 * (recovery into greed), or a 25% hard stop is hit to survive a deeper crash.
 * When it does NOT work: it loses when panic is not a buying opportunity — in a
 * genuine bear market F&G can stay pinned below 20 for months while price keeps
 * falling, and the 25% stop turns those entries into repeated losses. It also
 * misses fast V-recoveries that happen before F&G reacts.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 30) return null;

  // Fear & Greed is daily and aligns with 1d bars (proven in earlier cycles)
  const fg = ctx.data('fear_greed');
  if (fg == null) return null;   // no sentiment data -> no trade

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75;   // 25% hard stop: deep-crash protection
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fg >= 60) return { side: 'sell', qty: pos };   // recovery into greed -> take profit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% stop' },
               { side: 'sell', conds: [{ label: 'F&G >= 60 (greed)', now: fg, op: '>=', ref: 60, closed: true }], note: 'sell greed' }]);
    return null;
  }

  // Buy extreme fear. Only buy when flat (already guaranteed by early return above).
  if (fg > 20) return null;

  ctx.watch([{ side: 'buy', conds: [{ label: 'F&G <= 20 (extreme fear)', now: fg, op: '<=', ref: 20, closed: true }], note: 'buy panic' }]);

  // Fixed-fraction sizing: 60% of cash — contrarian trades are rare but volatile,
  // and the 25% stop caps the damage if the crash continues.
  const qty = (ctx.cash * 0.60) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
