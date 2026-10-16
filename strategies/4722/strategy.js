/*
 * @coinsori-strategy v1
 * name: DualSmaTrend4h
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: in a clear uptrend hold longs, in a clear downtrend hold shorts —
 * the only way to beat simply holding BTC is to also make money when it falls.
 * When it buys and sells: long when price is above a 200-SMA that is itself rising,
 * short when price is below a 200-SMA that is itself falling. It HOLDS the position as
 * long as the 200-SMA keeps moving in the trend direction, so pullbacks inside a bull
 * market do not throw it out. Every position has a 2x ATR stop as the hard loss cap.
 * When it does NOT work: in a flat sideways market the trend filter keeps it out, so it
 * never loses much but also never earns — and in a violent V-shaped reversal the stop
 * takes the loss before the trend turns. Shorting during a sharp squeeze is its worst
 * case, capped by the stop.
 */
function onUpdate(ctx) {
  // ---- closed-bar trend state (identical in backtest/paper/live) ----
  const price = ctx.closes.at(-2);          // last closed bar
  const sma = ctx.sma(200, 1);             // 200-SMA of last closed bar
  const smaPrev = ctx.sma(200, 2);
  const sma20ago = ctx.sma(200, 21);        // 200-SMA 20 bars earlier
  if (price == null || sma == null || smaPrev == null || sma20ago == null) return null;

  const trendUp = sma > smaPrev;            // 200-SMA rising = uptrend
  const trendDn = sma < smaPrev;            // 200-SMA falling = downtrend

  // trend-strength filter: SMA must have moved >0.05% over 20 bars (confirmed trend, not chop)
  const move = (sma - sma20ago) / sma20ago;
  const strong = Math.abs(move) > 0.0005;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;
  const stopDist = 2 * atr;                 // 2x ATR stop distance

  // ---- position sizing: risk 2% of cash per trade, capped at 6x notional ----
  const qty = Math.min(ctx.cash * 0.02 / stopDist, ctx.cash * 6 / ctx.price);

  // ---- exits: only when the trend itself turns (SMA slope flip) or the stop hits ----
  if (ctx.position > 0) {
    const stop = ctx.entryPx - stopDist;
    ctx.watch([{ side:'sell', price: stop, trigger:'below', note:'2xATR stop' }]);
    if (trendDn || price < stop) return { side:'sell', qty: ctx.position };
    return null;
  }
  if (ctx.position < 0) {
    const stop = ctx.entryPx + stopDist;
    ctx.watch([{ side:'buy', price: stop, trigger:'above', note:'2xATR stop' }]);
    if (trendUp || price > stop) return { side:'buy', qty: -ctx.position };
    return null;
  }

  // ---- entries: price on the correct side of the SMA + confirmed trend ----
  if (trendUp && strong && price > sma) return { side:'buy', qty };
  if (trendDn && strong && price < sma) return { side:'sell', qty };
  return null;
}
