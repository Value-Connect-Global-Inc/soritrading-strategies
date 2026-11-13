/*
 * @coinsori-strategy v1
 * name: BTC Trend + VIX Gate 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Trend-following on BTC with a volatility-regime ENTRY gate. A sharply
 * spiking VIX (z-score > +1.5 vs its own 90-day mean) marks panic that usually drags crypto
 * down; a calm VIX lets risk-on trend entries through. Gate is entry-only; once in we ride the
 * trend and let trend/stop decide the exit.
 * When it buys and sells: buy when EMA50 crosses above EMA200 on BTC AND VIX is not more than
 * 1.5 std above its 90-day mean. Sell when EMA50 crosses below EMA200, or the 3x ATR stop is
 * hit. No macro-based exit.
 * When it does NOT work: in a flat chop the EMA crossover whipsaws and pays fees; if VIX stays
 * elevated for months the gate blocks entries and it misses a slow grind-up; VIX is a daily
 * signal (2-day lag) so it cannot react to a fast intra-crypto crash.
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

  const vix = ctx.data('base_vix');
  const st = ctx.state;
  st.vixHist = st.vixHist || [];
  if (vix != null) {
    st.vixHist.push(vix);
    if (st.vixHist.length > 600) st.vixHist.shift();
  }
  let vixOk = true;
  if (st.vixHist.length >= 540) {
    const h = st.vixHist.slice(-540);
    const m = h.reduce((a, b) => a + b, 0) / h.length;
    let v = 0; for (const x of h) v += (x - m) * (x - m);
    const s = Math.sqrt(v / h.length);
    vixOk = s > 1e-9 ? (vix - m) / s < 1.5 : true; // not a panic spike
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
  if (up && vixOk) {
    const qty = (ctx.cash * 0.98) / ctx.price;
    ctx.watch([{ side: 'buy', price: close, trigger: 'above', note: 'EMA50/200 cross up',
      conds: [{ label: 'VIX not spiking', ok: vixOk }] }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([]);
  return null;
}
