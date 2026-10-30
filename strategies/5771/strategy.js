/*
 * @coinsori-strategy v1
 * name: BTC VIX Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The CBOE VIX measures fear in US equities. Crypto is a risk asset that
 * tends to trend up when VIX is calm and crash when VIX spikes into panic. VIX is macro data
 * that price alone cannot see, so it gates entries away from high-volatility chop.
 * When it buys and sells: Buy when VIX is calm (below 20, risk-on), the 200-bar trend is rising,
 * and price is above its 50-bar average. Sell when VIX spikes above 28 (panic), when the 200-bar
 * trend breaks down, or on a 12% hard stop.
 * When it does NOT work: In a bull where VIX sits moderately elevated (20-28) it stays in cash and
 * misses the rally. During a fast VIX spike the panic exit can sell near the bottom of a flush.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const vix = ctx.data('base_vix'); // CBOE VIX, daily, lag 2d (no look-ahead)
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma50 == null || sma200 == null || sma200prev == null) return null;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.88 : null; // 12% hard stop
    ctx.watch([
      { side: 'sell', price: 28, trigger: 'above', note: 'VIX panic exit' },
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' },
      { side: 'sell', price: stop, trigger: 'below', note: '12% stop' }
    ]);
    // Exit on panic (VIX>28): fear spikes usually precede drawdowns, cut risk.
    if (vix != null && vix > 28) return { side: 'sell', qty: pos, reduceOnly: true };
    // Exit on trend break: the 200-bar average is the long-term regime line.
    if (price < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (entryPx != null && price < entryPx * 0.88) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // Entry: calm regime (VIX<20, below its long-run ~19 average) + uptrend + momentum above SMA50.
  // VIX<20 keeps us out of bears and crashes where high volatility chops trend trades to death.
  const trendUp = sma200 > sma200prev;
  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'above', note: 'calm VIX + trend up', conds: [
      { label: 'VIX', now: vix, op: '<', ref: 20, closed: true },
      { label: 'SMA200 rising', ok: trendUp }
    ]}
  ]);
  if (vix != null && vix < 20 && trendUp && price > sma50) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.9 };
  }

  return null;
}
