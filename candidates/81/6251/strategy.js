/*
 * @coinsori-strategy v1
 * name: BTC Fast Trend + NDX Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A FASTER trend core (EMA20/50 crossover) with the proven NDX entry gate.
 * A faster crossover re-enters sooner after pullbacks, so it can capture more of a long bull
 * run than the slow EMA50/200 core, while the equity gate still blocks new longs in a clear
 * equity bear. Hypothesis: more of the 2020-21 bull captured.
 * When it buys and sells: buy when EMA20 crosses above EMA50 on BTC AND NASDAQ is not more
 * than 2% below its 90-day average; sell when EMA20 crosses below EMA50, or the 3x ATR stop
 * is hit. No macro-based exit.
 * When it does NOT work: a faster crossover whipsaws more in chop and pays more fees; in a
 * crypto-specific rally that equities do not join the NDX gate keeps it flat and it misses
 * the move.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const ema20 = ctx.ema(20, 1), ema50 = ctx.ema(50, 1);
  const ema20p = ctx.ema(20, 2), ema50p = ctx.ema(50, 2);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || ema50 == null || ema20p == null || ema50p == null || atr == null) {
    ctx.watch([]); return null;
  }
  const close = ctx.closes.at(-2);

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
    const down = ema20p >= ema50p && ema20 < ema50;
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    if (down || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'trend/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  const up = ema20p <= ema50p && ema20 > ema50;
  if (up && ndxOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'EMA20/50 cross up',
      conds: [{ label: 'NDX not in clear bear', ok: ndxOk }] }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
