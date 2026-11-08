/*
 * @coinsori-strategy v1
 * name: BTC Regime-Gated Trend Ride 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly, but buying every time price crosses a slow average buys
 * into bear-market rallies that fail, and a slow exit rides crashes down. This version only buys
 * when the long trend is genuinely up (price above the 200-bar average AND that average is rising)
 * and only sells when the trend has genuinely turned (price below it AND it is falling), so it holds
 * bull pullbacks, skips bear rallies, and exits crashes with confirmation. It never puts more than
 * 80% of cash at risk, keeping a buffer for crashes.
 * When it buys and sells: Buy when price closes above the 200-bar average AND the 200-bar average
 * is rising (20-bar confirmation), sized to a 3% per-bar volatility target, capped at 80% of cash.
 * Sell when price closes below the 200-bar average AND the 200-bar average is falling.
 * When it does NOT work: In a long sideways range it whipsaws around the average. In a raging bull
 * it is out of the market during pullbacks so it lags buy-and-hold, which never sells.
 */

function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const price = ctx.price;
  const closes = ctx.closes;
  if (closes == null || closes.length < 60) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2);
  if (closePrev == null) { ctx.watch([]); return null; }

  const sma200 = ctx.sma(200, 1);
  const sma200Ago = ctx.sma(200, 20);
  if (sma200 == null || sma200Ago == null) { ctx.watch([]); return null; }

  // realized vol = stdev of the last 30 4h returns (all closed bars)
  const n = 30;
  const base = closes.length - 2;
  let sum = 0, sumSq = 0;
  for (let k = 0; k < n; k++) {
    const r = closes[base - k] / closes[base - k - 1] - 1;
    sum += r; sumSq += r * r;
  }
  const mean = sum / n;
  const sd = Math.sqrt(Math.max(sumSq / n - mean * mean, 0));
  // target 3% per 4h bar, capped at 80% of cash to keep a buffer for crashes
  const size = Math.min(0.8, 0.03 / Math.max(sd, 0.01));

  const regimeUp = closePrev > sma200 && sma200 > sma200Ago;
  const trendTurned = closePrev < sma200 && sma200 < sma200Ago;

  const watch = [];
  watch.push({ side: 'buy', price: sma200, trigger: 'above', note: 'Long: 200-bar regime up (vol-sized)' });
  watch.push({ side: 'sell', price: sma200, trigger: 'below', note: 'Exit: 200-bar trend turned' });
  ctx.watch(watch);

  if (pos <= 0) {
    if (regimeUp) {
      return { side: 'buy', qty: (ctx.cash / price) * size * 0.95 };
    }
    return null;
  }

  if (pos > 0) {
    if (trendTurned) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }
  return null;
}
