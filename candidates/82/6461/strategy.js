/*
 * @coinsori-strategy v1
 * name: BTC Long-Only EMA Trend 4h
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A long-only trend strategy that holds BTC while the trend
 * is up and steps aside (flat) while it is down. Being flat in falling markets
 * gives a much smaller drawdown than buy-and-hold.
 * When it buys and sells: buys when EMA50 crosses above EMA200; sells (closes)
 * when EMA50 crosses below EMA200 or a hard stop is hit.
 * When it does NOT work: in a choppy sideways market the EMA cross whipsaws and
 * pays fees both ways; it never shorts, so it underperforms in strongly falling
 * markets where shorting would win. In a strong one-way bull it roughly matches
 * holding (it is in the market most of the time) while paying fees.
 */
function onUpdate(ctx) {
  // After a forced close the edge is reduce-only: do not open new positions.
  if (ctx.alloc && ctx.alloc.status !== 'ok') {
    ctx.watch([]);
    return null;
  }

  // Trend cross on CLOSED bars (ago=1 vs ago=2) — identical in backtest and live.
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  const e50p = ctx.ema(50, 2);
  const e200p = ctx.ema(200, 2);
  if (e50 == null || e200 == null || e50p == null || e200p == null) {
    ctx.watch([]);
    return null;
  }

  const price = ctx.price;
  const pos = ctx.position;

  // Hard stop: 15% adverse move from entry. Protects against a single bad trend call.
  const stopPct = 0.15;
  let stopPx = null;
  if (ctx.entryPx != null) {
    stopPx = ctx.entryPx * (1 - stopPct);
  }

  const crossUp = e50p <= e200p && e50 > e200;   // bullish cross
  const crossDown = e50p >= e200p && e50 < e200; // bearish cross

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: price, trigger: 'below', note: 'EMA bearish cross', conds: [{ label: 'EMA50<EMA200', ok: e50 < e200 }] },
      ...(stopPx != null ? [{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop -15%' }] : [])
    ]);
    if (crossDown || (stopPx != null && price <= stopPx)) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: buy only on a fresh bullish cross. Never short.
  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'long on bull cross', conds: [{ label: 'EMA50>EMA200', ok: e50 > e200 }] }
  ]);

  if (crossUp && e50 > e200) {
    const qty = (ctx.cash / price) * 0.95;
    return { side: 'buy', qty: qty };
  }

  return null;
}
