/*
 * @coinsori-strategy v1
 * name: BTC Rates-Scaled Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Long-term Treasury yields are a risk-on/off switch for
 * crypto, but a hard gate misses bull markets that run with rising yields. So
 * we keep riding BTC's trend and instead SCALE the position: full size when
 * the 10Y yield is below its own 60-observation average (easing = tailwind),
 * half size when yields are rising (headwind).
 * When it buys and sells: Buy when BTC closes above its 200-bar average. Hold
 * while above. Sell when it closes back below, or on a 15% stop. Position size
 * depends on the yield regime (full vs half).
 * When it does NOT work: The half-size regime reduces gains in a strong bull
 * that happens to run alongside rising yields, so it can lag buy-and-hold in
 * reflation-style bull markets. Yield data is 2 days delayed.
 */
function onUpdate(ctx) {
  const s = ctx.state;

  // ---- regime: 10Y yield vs its own 60-obs average ----
  const y10 = ctx.data('base_ust10y');
  if (y10 == null) return null;
  if (!s.hist) s.hist = [];
  const last = s.hist.length ? s.hist[s.hist.length - 1] : null;
  if (last === null || Math.abs(last - y10) > 1e-9) { // append only when the observation changes
    s.hist.push(y10);
    if (s.hist.length > 60) s.hist.shift();
  }
  if (s.hist.length < 30) return null;
  const sum = s.hist.reduce((a, b) => a + b, 0);
  const y10sma = sum / s.hist.length;
  const sizeScale = y10 < y10sma ? 1.0 : 0.5; // full size in easing, half in headwind

  // ---- trend: BTC above 200-bar SMA (closed bars, identical live/backtest) ----
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma200 == null || sma200prev == null) return null;
  const prevClose = ctx.closes.at(-2);
  const prevPrevClose = ctx.closes.at(-3);
  const above = prevClose > sma200;

  const inPos = ctx.position > 0;
  const trendBroken = prevClose < sma200 && prevPrevClose >= sma200prev;
  const stopPx = ctx.entryPx != null ? ctx.entryPx * 0.85 : null;

  if (inPos && (trendBroken || (stopPx != null && ctx.price <= stopPx))) {
    ctx.watch([
      { side:'sell', price: sma200, trigger:'below', note:'SMA200 trend break' },
      { side:'sell', price: stopPx != null ? stopPx : sma200, trigger:'below', note:'15% stop' }
    ]);
    return { side:'sell', qty: ctx.position, reduceOnly:true };
  }

  if (!inPos && above) {
    const stop = prevClose * 0.85;
    ctx.watch([
      { side:'buy', price: sma200, trigger:'above', note:'SMA200 trend' },
      { side:'sell', price: stop, trigger:'below', note:'15% stop' }
    ]);
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 * sizeScale };
  }

  ctx.watch([]);
  return null;
}
