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
 * euphoric (F&G >= 60) harvests the recovery that follows panic. The key filter:
 * panic is only a buying opportunity when the market is still in an uptrend
 * (price above the 200-SMA) — a fear dip inside an uptrend recovers, while
 * fear inside a downtrend is a genuine bear that keeps falling.
 * When it buys and sells: buy when Fear & Greed is 20 or below AND price is
 * above the 200-SMA. Sell when Fear & Greed climbs back to 60 or above, or a
 * 25% hard stop is hit.
 * When it does NOT work: it misses the best panic buys that happen below the
 * 200-SMA (deep-crash bottoms), and it still loses if an uptrend breaks down
 * right after the entry. In a slow bear with price above a still-rising 200-SMA
 * it can buy repeatedly into a deteriorating market.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 220) return null;

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

  // Buy extreme fear, but ONLY inside an uptrend (price above 200-SMA).
  // Panic in an uptrend = pullback that recovers; panic in a downtrend = bear.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  if (fg > 20) return null;
  if (price <= sma200) return null;

  ctx.watch([{ side: 'buy', conds: [{ label: 'F&G <= 20 (extreme fear)', now: fg, op: '<=', ref: 20, closed: true },
                                    { label: 'price > 200-SMA', ok: price > sma200, closed: true }], note: 'buy panic in uptrend' }]);

  // Fixed-fraction sizing: 60% of cash — contrarian trades are rare but volatile,
  // and the 25% stop caps the damage if the crash continues.
  const qty = (ctx.cash * 0.60) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
