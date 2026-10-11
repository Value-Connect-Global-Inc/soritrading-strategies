/*
 * @coinsori-strategy v1
 * name: BTC Squeeze-Breakout Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Volatility-squeeze breakout — when Bollinger band width
 * compresses to a multi-month low, a large move is building; buying the breakout
 * out of that squeeze, only in a rising 200-day trend, catches the expansion.
 * This is a different family from the ADA Donchian champion: the champion buys
 * ANY 55-bar-high breakout, this one only buys breakouts that follow a volatility
 * contraction (the squeeze), which filters out low-energy fake breakouts.
 * When it buys and sells: buys when the 20-day Bollinger width is in the quietest
 * 30% of the last 60 days (squeeze) AND a closed bar closes above the 20-day high
 * AND the 200-day average is rising. Sells when a closed bar closes below the
 * 20-day low (patient — lets winners run in a trend), or price falls 2.5 ATR
 * below entry (hard risk cap).
 * When it does NOT work: In a slow grinding bull with no compression the squeeze
 * never fires and it sits in cash while a plain breakout rides. In a chop that
 * compresses then breaks down, the breakout is a trap. Volatility can stay low
 * for months (dead market) — no trades, no gain.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  if (closes.length < 70) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (atr == null || atr <= 0 || sma200 == null || sma200prev == null) return null;
  const trendUp = sma200 > sma200prev;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const channelLow = Math.min(...closes.slice(-22, -2));   // 20-day low exit
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' },
               { side: 'sell', price: channelLow, trigger: 'below', note: '20-day low exit' }]);
    if (prevClose < channelLow || price < stop) return { side: 'sell', qty: pos };
    return null;
  }

  // Manual rolling 20-bar BB width from closes (robust, no ago-loop).
  const widths = [];
  for (let k = 0; k < 60; k++) {
    const end = closes.length - 2 - k;
    const start = end - 20;
    if (start < 0) break;
    const win = closes.slice(start, end);
    if (win.length < 20) break;
    let sum = 0;
    for (const c of win) sum += c;
    const mid = sum / 20;
    if (mid <= 0) continue;
    let sd = 0;
    for (const c of win) sd += (c - mid) * (c - mid);
    sd = Math.sqrt(sd / 20);
    const w = (2 * sd) / mid;
    if (w > 0) widths.push(w);
  }
  if (widths.length < 30) return null;
  const widthNow = widths[0];
  const sorted = widths.slice().sort((a, b) => a - b);
  const q30 = sorted[Math.floor(sorted.length * 0.3)];
  const squeezed = widthNow <= q30;

  const channelHigh = Math.max(...closes.slice(-22, -2));
  const breakout = prevClose > channelHigh;

  if (squeezed && breakout && trendUp) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
