/*
 * @coinsori-strategy v1
 * name: BTC Ride100 + NDX Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Middle ground between the slow EMA50/200 crossover and the ride-the-200.
 * Hold long while price is above EMA100 (does NOT exit on minor pullbacks, so it captures more
 * of a bull than the crossover), but re-enter on a close above EMA100 (faster than waiting for
 * EMA200, so it gets back in sooner after a crash). The NDX entry gate blocks new longs in a
 * clear equity bear.
 * When it buys and sells: buy when price closes above EMA100 (after being below) AND NASDAQ is
 * not more than 2% below its 90-day average; sell when price closes below EMA100, or the 3x
 * ATR stop is hit. No macro-based exit.
 * When it does NOT work: in a choppy range that repeatedly crosses the 100 it whipsaws and
 * pays fees; in a crypto-specific rally that equities do not join the NDX gate keeps it flat
 * and it misses the move.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const ema100 = ctx.ema(100, 1), ema100p = ctx.ema(100, 2);
  const atr = ctx.atr(14, 1);
  if (ema100 == null || ema100p == null || atr == null) {
    ctx.watch([]); return null;
  }
  const close = ctx.closes.at(-2);
  const prevClose = ctx.closes.at(-3);

  const ndx = ctx.data('base.ndx');
  const st = ctx.state;
  st.ndxHist = st.ndxHist || [];
  if (ndx != null) {
    st.ndxHist.push(ndx);
    if (st.ndxHist.length > 600) st.ndxHist.shift();
  }
  let ndxOk = true;
  if (st.ndxHist.length >= 540) {
    const h = st.ndxHist.slice(-540);
    const m = h.reduce((a, b) => a + b, 0) / h.length;
    ndxOk = ndx != null && ndx >= m * 0.98;
  }

  if (pos > 0) {
    const broke = prevClose >= ema100p && close < ema100;
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    if (broke || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '100-break/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  const crossedUp = prevClose <= ema100p && close > ema100;
  if (crossedUp && ndxOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'close above EMA100',
      conds: [{ label: 'NDX not in clear bear', ok: ndxOk }] }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
