/*
 * @coinsori-strategy v1
 * name: BTC Momentum VIX Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 1000
 *
 * Why this strategy: BTC trends persist for days to weeks once a clear trend is
 * established, but its crashes are sharp and fast. Gating a long-only trend
 * strategy on a global risk-on/off indicator (the VIX) keeps it out of the
 * market exactly when crashes tend to start.
 * When it buys and sells: it buys when BTC closes back above its 100-bar (16-day)
 * trend line while the VIX is calm (below 27), and sells when BTC closes back
 * below the trend line or falls 12% below its entry. It never enters while the
 * VIX is elevated.
 * When it does NOT work: it is long-only, so in a rising market it can miss part
 * of the rise that buy-and-hold gets in full; it also sits out for a while after
 * VIX spikes, which can miss the early rebound. It makes no money in a flat or
 * choppy market where the trend line is crossed back and forth.
 */
function onUpdate(ctx) {
  const trendN = 100;    // 4h * 100 ~ 16.6 days trend line
  const vixEnter = 27;   // only enter when VIX is below this (risk-on)
  const stopPct = 0.12;  // hard stop 12% below entry

  const ema1 = ctx.ema(trendN, 1);
  const ema2 = ctx.ema(trendN, 2);
  if (ema1 == null || ema2 == null) return null;
  const prevClose = ctx.closes.at(-2);   // last CLOSED bar
  const prevPrevClose = ctx.closes.at(-3);
  if (prevClose == null || prevPrevClose == null) return null;

  // VIX risk-on/off gate. If the value is unavailable, trade on price alone.
  const vix = ctx.data('base_vix');
  const riskOn = vix == null ? true : vix < vixEnter;

  // Declare what we wait for: trend-line crosses and the stop level.
  const watch = [
    { side: 'buy', price: ema1, trigger: 'above', note: 'trend breakout', conds: [{ label: 'VIX<27', ok: riskOn }] },
    { side: 'sell', price: ema1, trigger: 'below', note: 'trend break' }
  ];
  if (ctx.position > 0 && ctx.entryPx != null) {
    watch.push({ side: 'sell', price: ctx.entryPx * (1 - stopPct), trigger: 'below', note: 'stop-loss' });
  }
  ctx.watch(watch);

  // Hard stop first (active every bar).
  if (ctx.position > 0 && ctx.entryPx != null && ctx.price <= ctx.entryPx * (1 - stopPct)) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }

  const crossedUp = prevPrevClose <= ema2 && prevClose > ema1;
  const above = prevClose > ema1;

  if (ctx.position > 0) {
    if (!above) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  if (crossedUp && riskOn) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
