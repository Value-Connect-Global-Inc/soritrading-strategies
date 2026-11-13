/*
 * @coinsori-strategy v1
 * name: BTC Chandelier Trend Ride 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends strongly, but a plain trend ride that exits on a slow 200-bar
 * crossover rides crashes all the way down before confirming the turn. A trailing ATR stop
 * ("chandelier") locks in gains as the high advances and cuts losers early, so the strategy keeps
 * most of the trend's upside with a much smaller drawdown. Entries still wait for a confirmed
 * uptrend (price above a rising 200-bar average).
 * When it buys and sells: Buy when price closes above the 200-bar average AND that average is
 * rising, sized to a 3% per-bar volatility target (max 80% of cash). Sell when price closes below
 * the trailing stop = highest high SINCE ENTRY minus 4x ATR(14), or when the 200-bar average turns
 * down.
 * When it does NOT work: In a wide sideways range it whipsaws around the average and the trailing
 * stop exits during normal pullbacks, paying fees. In a slow grind higher with tiny ATR the stop
 * can be too tight and exit early, missing the late rally.
 */

function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const price = ctx.price;
  const closes = ctx.closes;
  if (closes == null || closes.length < 205) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2);
  const highPrev = ctx.highs.at(-2);
  if (closePrev == null || highPrev == null) { ctx.watch([]); return null; }

  const sma200 = ctx.sma(200, 1);
  const sma200Ago = ctx.sma(200, 20);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma200Ago == null || atr == null) { ctx.watch([]); return null; }

  // realized vol = stdev of the last 30 closed 4h returns (same sizing as the proven trend ride)
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

  const K = 4; // chandelier multiplier: wider stop = fewer whipsaw exits, bigger drawdown per trade

  let st = ctx.state || {};
  if (pos <= 0) {
    st.hh = null;
    ctx.state = st;
    ctx.watch([
      { side: 'buy', price: sma200, trigger: 'above', note: 'Long: 200-bar regime up (vol-sized)' }
    ]);
    if (regimeUp) {
      return { side: 'buy', qty: (ctx.cash / price) * size * 0.95 };
    }
    return null;
  }

  // in a position: trail the highest high SINCE ENTRY (closed bars only, no look-ahead).
  if (st.hh == null) {
    st.hh = (ctx.entryPx != null && ctx.entryPx > highPrev) ? ctx.entryPx : highPrev;
  } else if (highPrev > st.hh) {
    st.hh = highPrev;
  }
  ctx.state = st;

  const chandStop = st.hh - K * atr;
  const exit = closePrev < chandStop || trendTurned;

  ctx.watch([
    { side: 'sell', price: chandStop, trigger: 'below', note: 'Chandelier trailing stop (4xATR)' },
    { side: 'sell', price: sma200, trigger: 'below', note: 'Exit: 200-bar trend turned' }
  ]);

  if (exit) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
