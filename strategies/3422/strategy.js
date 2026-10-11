/*
 * @coinsori-strategy v1
 * name: BTC Vol Squeeze Breakout 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: volatility compresses into a squeeze before expanding; buying the expansion
 * while the long-term trend is up catches strong moves early.
 * When it buys and sells: buys when price breaks above the 20-day high while the 200-day SMA is
 * rising and Bollinger Band width is in its bottom 30%; sells when price falls back below the 20-day
 * low (Donchian exit) or hits a 2xATR stop.
 * When it does NOT work: in choppy sideways markets with no trend and in prolonged bear markets —
 * it stays in cash during downtrends, so it misses the eventual bottom.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (bb == null || sma200 == null || sma200Prev == null || atr == null) return null;

  // Squeeze: current BB width in the bottom 30% of the last 100 bars (compression precedes expansion)
  const width = (bb.upper - bb.lower) / bb.mid;
  let narrow = 0, cnt = 0;
  for (let a = 1; a <= 100; a++) {
    const b = ctx.bb(20, 2, a);
    if (b == null) continue;
    cnt++;
    if ((b.upper - b.lower) / b.mid <= width) narrow++;
  }
  if (cnt < 40) return null;
  const squeeze = narrow / cnt <= 0.3;

  const hi = ctx.high(20, 1);
  const lo = ctx.low(20, 1);
  if (hi == null || lo == null) return null;

  if (ctx.position > 0) {
    const stopPx = ctx.entryPx - 2 * atr; // safety net only; Donchian exit is the main exit
    ctx.watch([
      { side: 'sell', price: lo, trigger: 'below', note: 'Donchian exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' }
    ]);
    // Donchian exit: cut the position as soon as price breaks the 20-day low (fast loss control)
    if (ctx.price < lo) return { side: 'sell', qty: ctx.position };
    if (ctx.entryPx != null && ctx.price < stopPx) return { side: 'sell', qty: ctx.position };
    return null;
  }

  if (squeeze && sma200 > sma200Prev && ctx.price > hi) {
    ctx.watch([{ side: 'buy', price: hi, trigger: 'above', note: 'breakout',
      conds: [{ label: 'BB squeeze', ok: true }, { label: 'SMA200 rising', ok: true }] }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }

  ctx.watch([{ side: 'buy', price: hi, trigger: 'above', note: 'breakout' }]);
  return null;
}
