/*
 * @coinsori-strategy v1
 * name: BTC Trend + Dollar Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on BTC with a US Dollar regime ENTRY gate. A sharply
 * strengthening dollar (z-score > +1.5 vs its own 90-day mean) marks risk-off that usually
 * drags crypto down; a weak/mild dollar lets risk-on trend entries through. Gate is
 * entry-only; once in we ride the trend and let trend/stop decide the exit.
 * When it buys and sells: buy when EMA50 crosses above EMA200 on BTC AND the broad dollar
 * index is not more than 1.5 std above its 90-day mean. Sell when EMA50 crosses below EMA200,
 * or the 3x ATR stop is hit. No macro-based exit.
 * When it does NOT work: in a flat chop the EMA crossover whipsaws and pays fees; if the
 * dollar rises slowly for months without an extreme spike the gate never blocks and offers no
 * protection; the dollar is a daily signal (10-day lag) so it cannot react to a fast
 * intra-crypto crash.
 */
function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const ema50 = ctx.ema(50, 1), ema200 = ctx.ema(200, 1);
  const ema50p = ctx.ema(50, 2), ema200p = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || ema200 == null || ema50p == null || ema200p == null || atr == null) {
    ctx.watch([]); return null;
  }
  const close = ctx.closes.at(-2);

  const usd = ctx.data('base_usd_broad');
  const st = ctx.state;
  st.usdHist = st.usdHist || [];
  if (usd != null) {
    st.usdHist.push(usd);
    if (st.usdHist.length > 600) st.usdHist.shift();
  }
  let usdOk = true;
  if (st.usdHist.length >= 540) { // 540 bars = 90 days at 4h
    const h = st.usdHist.slice(-540);
    const m = h.reduce((a, b) => a + b, 0) / h.length;
    let v = 0; for (const x of h) v += (x - m) * (x - m);
    const s = Math.sqrt(v / h.length);
    usdOk = s > 1e-9 ? (usd - m) / s < 1.5 : true; // not unusually strong dollar
  }

  if (pos > 0) {
    const down = ema50p >= ema200p && ema50 < ema200;
    const stop = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;
    if (down || (stop != null && close < stop)) {
      ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: 'trend/stop exit' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch([{ side: 'sell', price: stop != null ? stop : close, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  const up = ema50p <= ema200p && ema50 > ema200;
  if (up && usdOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'EMA50/200 cross up',
      conds: [{ label: 'dollar not strong', ok: usdOk }] }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
