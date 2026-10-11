/*
 * @coinsori-strategy v1
 * name: DXY Gated BTC Trend 4H V2
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly on 4h during risk-on (weak dollar) regimes; a slow EMA crossover enters, and a trailing stop lets winners run. It re-enters whenever the uptrend is still intact so a stop-out does not keep it flat through the rest of a bull run.
 * When it buys and sells: Buys when flat AND (50 EMA above 200 EMA) AND price above the 400-bar average AND Dollar Index below 104 AND the closed bar's volume is at/above its 50-bar average. Sells when price falls 8% below the highest close since entry.
 * When it does NOT work: Re-entering after a stop-out can buy the top of a failed rally in choppy markets, and the volume filter can keep it out of valid low-volume legs. Below the 400-bar average it never trades, and during a strong-dollar rally (DXY > 104) it stays out and misses the move.
 */
function onUpdate(ctx) {
  const emaF = ctx.ema(50, 1), emaS = ctx.ema(200, 1);
  const sma400 = ctx.sma(400, 1);
  const price = ctx.closes.at(-2);
  if (emaF == null || emaS == null || sma400 == null || price == null) return null;

  // ---- trailing stop exit (caps loss at 8% of the peak, lets winners run) ----
  if (ctx.position > 0) {
    const hi = ctx.state.hi != null ? Math.max(ctx.state.hi, price) : price;
    ctx.state.hi = hi;
    const stopPx = hi * 0.92;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '8% trailing stop' }]);
    return null;
  }

  // ---- entry only when flat ----
  // Macro filter: only take longs when the Dollar Index is weak (risk-on for crypto).
  // 104 is roughly the long-term middle of DXY; if the series is unavailable (null) we don't block.
  const dxy = ctx.macro('dxy');
  if (dxy != null && dxy >= 104) return null;

  // Re-entry rule: a fresh 50/200 cross OR an intact uptrend (50 above 200, price
  // above the 400-bar trend line) — so a stop-out doesn't keep us flat through the
  // rest of a bull run. Reason: without it, the cross only fires once per cycle.
  const trendUp = emaF > emaS && price > sma400;
  if (trendUp) {
    // Volume confirmation: only enter when the last closed bar's volume is at or
    // above its 50-bar average. Reason: genuine trend starts come on conviction
    // volume; low-volume entries in an extended range are the fake breakouts that
    // the re-entry rule then pays for. Unknown volume -> stay out.
    const v = ctx.volumes.at(-2);
    const av = ctx.avgVol(50);
    if (v == null || av == null || av <= 0 || v < av) return null;
    ctx.state.hi = price;
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
