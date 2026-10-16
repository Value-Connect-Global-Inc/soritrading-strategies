/*
 * @coinsori-strategy v1
 * name: DualSideTrend4h
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: in a clear uptrend hold longs, in a clear downtrend hold shorts —
 * the only way to beat simply holding BTC is to also make money when it falls.
 * When it buys and sells: long when price is above a 200-SMA that is itself rising,
 * short when price is below a 200-SMA that is itself falling, flat in between.
 * Entries only fire when the 200-SMA has moved more than 0.05% in the last 20 bars
 * (confirmed trend, avoids chop). Every position has a 2x ATR stop.
 * When it does NOT work: in a flat sideways market the trend filter keeps it in cash,
 * so it never loses much but also never earns — and in a violent V-shaped reversal the
 * short gets stopped out at a loss before the trend turns. Shorting during a sharp
 * squeeze (like the 2021 bull) is its worst case, capped by the stop.
 */
function onUpdate(ctx) {
  // ---- closed-bar trend state (identical in backtest/paper/live) ----
  const price = ctx.closes.at(-2);          // last closed bar
  const prev = ctx.closes.at(-3);
  const sma = ctx.sma(200, 1);              // 200-SMA of last closed bar
  const smaPrev = ctx.sma(200, 2);
  const sma20ago = ctx.sma(200, 21);        // 200-SMA 20 bars earlier
  if (price == null || prev == null || sma == null || smaPrev == null || sma20ago == null) return null;

  const trendUp = price > sma && sma > smaPrev;   // price above rising SMA
  const trendDn = price < sma && sma < smaPrev;   // price below falling SMA

  // trend-strength filter: SMA must have moved >0.05% over 20 bars (confirmed trend, not chop)
  const move = (sma - sma20ago) / sma20ago;
  const strong = Math.abs(move) > 0.0005;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopDist = 2 * atr;                 // 2x ATR stop distance

  // ---- position sizing: risk 2% of cash per trade, capped at 6x notional ----
  const qty = Math.min(ctx.cash * 0.02 / stopDist, ctx.cash * 6 / ctx.price);

  // ---- exits ----
  if (ctx.position > 0) {
    const stop = ctx.entryPx - stopDist;
    if (price < sma || price < stop) {
      ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'2xATR stop' }]);
      return { side:'sell', qty: ctx.position };
    }
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'2xATR stop' }]);
    return null;
  }
  if (ctx.position < 0) {
    const stop = ctx.entryPx + stopDist;
    if (price > sma || price > stop) {
      ctx.watch([{ side:'buy', price: stop, trigger:'above', note:'2xATR stop' }]);
      return { side:'buy', qty: -ctx.position };
    }
    ctx.watch([{ side:'buy', price: stop, trigger:'above', note:'2xATR stop' }]);
    return null;
  }

  // ---- entries ----
  if (trendUp && strong) return { side:'buy', qty };
  if (trendDn && strong) return { side:'sell', qty };
  return null;
}
