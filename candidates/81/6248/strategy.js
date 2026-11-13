/*
 * @coinsori-strategy v1
 * name: BTC Ride the 200 + NDX Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A single long-term regime filter — stay long while price holds above its
 * EMA200, exit when it breaks below. Unlike an EMA50/200 crossover it does NOT exit on every
 * pullback, so it rides a long bull run (capturing more upside than the crossover), while an
 * equity-regime ENTRY gate (NASDAQ-100 not in a clear bear) blocks new longs when risk assets
 * are rolling over. A wide 5x ATR stop caps a single bad call.
 * When it buys and sells: buy when price closes above EMA200 (after being below) AND NASDAQ is
 * not more than 2% below its 90-day average; sell when price closes below EMA200, or the 5x
 * ATR stop is hit. No macro-based exit.
 * When it does NOT work: in a choppy range that repeatedly crosses the 200 it whipsaws and
 * pays fees; the stop is wide so a sharp crash can give back a large chunk before it exits;
 * in a crypto-specific rally that equities do not join the NDX gate keeps it flat and it
 * misses the move.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;

  const ema200 = ctx.ema(200, 1);
  const ema200prev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || ema200prev == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const close = ctx.closes.at(-2);
  const prevClose = ctx.closes.at(-3);

  // Equity regime (entry only): NDX not >2% below its 90-day average. NDX is daily; at 4h
  // (6 bars/day) a true 90-day window is 540 pushed bars.
  const ndx = ctx.data('base.ndx');
  const st = ctx.state;
  st.ndxHist = st.ndxHist || [];
  if (ndx != null) {
    st.ndxHist.push(ndx);
    if (st.ndxHist.length > 600) st.ndxHist.shift();
  }
  let ndxOk = true;
  if (st.ndxHist.length >= 540) {
    const recent = st.ndxHist.slice(-540);
    const mean = recent.reduce((a, b) => a + b, 0) / recent.length;
    ndxOk = ndx != null && ndx >= mean * 0.98;
  }

  if (pos > 0) {
    const brokeDown = prevClose >= ema200prev && close < ema200;
    const stop = ctx.entryPx != null ? ctx.entryPx - 5 * atr : null;
    if (brokeDown || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '200-break/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '5x ATR stop' }]);
    return null;
  }

  const crossedUp = prevClose <= ema200prev && close > ema200;
  if (crossedUp && ndxOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{
      side: 'buy', price: close, trigger: 'above', note: 'close above EMA200',
      conds: [{ label: 'NDX not in clear bear', ok: ndxOk }]
    }]);
    return { side: 'buy', qty: qty };
  }

  ctx.watch([]);
  return null;
}
