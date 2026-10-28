/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Usage Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin rallies tend to be sustainable when real network usage (daily active addresses) is also expanding — adoption confirms the price move. Buying an uptrend only when usage is growing filters out weak, momentum-only rallies.
 * When it buys and sells: It buys when price is above its 200-day average AND the 30-day average of active addresses is above its own recent 60-day average (usage expanding). It sells when price closes below the 200-day average, falls 3xATR below the highest close since entry (trailing stop), or falls 20% below entry as a disaster stop.
 * When it does NOT work: In a bull market driven purely by speculation where on-chain usage lags price, it stays out and misses the move. In a long decline, usage keeps falling too, so it sits in cash (safe but lags any V-shaped recovery). The trailing stop can exit early on a sharp but brief pullback inside a continuing uptrend.
 */
function onUpdate(ctx) {
  const usage = ctx.data("addr_sma30");
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (usage == null || sma200 == null || atr == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Rolling history of usage in restart-safe state; compare current to its own recent average
  const hist = ctx.state.usageHist || [];
  hist.push(usage);
  if (hist.length > 60) hist.shift();
  ctx.state.usageHist = hist;
  const prior = hist.slice(0, -1);
  const baseAvg = prior.length ? prior.reduce((s, x) => s + x, 0) / prior.length : usage;
  const usageExpanding = usage > baseAvg;

  if (ctx.position > 0) {
    // Track the highest close since entry for the ATR trailing stop (restart-safe)
    const peak = (ctx.state.peakClose != null && ctx.state.peakClose > prevClose) ? ctx.state.peakClose : prevClose;
    if (ctx.state.peakClose == null || prevClose > ctx.state.peakClose) ctx.state.peakClose = prevClose;
    // 3xATR below peak: standard trend-following trailing stop that adapts to volatility
    const trailStop = peak - 3 * atr;
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null; // 20% disaster stop
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: trailStop, trigger: 'below', note: '3xATR trailing stop' },
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' }
    ]);
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < trailStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }
  // Reset the trailing peak when flat
  ctx.state.peakClose = null;

  // Declare the price level we wait for while flat; usage expansion is the extra gate
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend', conds: [{ label: 'usage expanding', ok: usageExpanding, closed: true }] }
  ]);
  // Buy only when usage is expanding AND price is in a long-term uptrend
  if (usageExpanding && prevClose > sma200) {
    // 60% of cash per entry; 20% stop limits account risk to ~12%
    const qty = (0.6 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
