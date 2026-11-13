/*
 * @coinsori-strategy v1
 * name: BTC VIX-Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: crypto trends persist, but the worst drawdowns cluster in risk-off
 * episodes when the VIX spikes well above its own recent mean. We ride the
 * 4h trend while the VIX is calm, and refuse to open new longs into a VIX
 * panic. Once committed we stay long until the trend breaks — so a normal
 * bull pullback does not knock us out and we keep most of the upside.
 * Buy when price is above the 200-period EMA and the VIX z-score is calm
 * (z < 1.0); sell when price drops back under the EMA or a 2xATR hard stop
 * is hit. VIX only blocks entries, it never forces an exit.
 * Does not work in a slow grind with no trend (many small whipsaws) or when
 * the VIX stays pinned high for months (we sit out a real rally).
 */
function onUpdate(ctx) {
  const ema = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema == null || prevClose == null) return null;

  // Rolling VIX z-score vs its own recent mean (one observation per day)
  const st = ctx.state;
  if (!st.vixBuf) st.vixBuf = [];
  const vix = ctx.data("base_vix");
  if (vix != null) {
    const day = Math.floor(ctx.times.at(-1) / 86400);
    if (st.vixDay !== day) {
      st.vixDay = day;
      st.vixBuf.push(vix);
      if (st.vixBuf.length > 120) st.vixBuf.shift();
    }
  }
  if (st.vixBuf.length < 30) { ctx.watch([]); return null; } // regime unknown -> no trading yet

  let m = 0;
  for (const v of st.vixBuf) m += v;
  m /= st.vixBuf.length;
  let sd = 0;
  for (const v of st.vixBuf) sd += (v - m) * (v - m);
  sd = Math.sqrt(sd / st.vixBuf.length);
  const z = sd > 0 ? (vix - m) / sd : 0;
  const riskOn = z < 1.0; // entry gate only: do not open longs into a VIX panic
  const aboveTrend = prevClose > ema;
  const atr = ctx.atr(14, 1);

  if (ctx.position <= 0) {
    ctx.watch([{ side:'buy', price: ema, trigger:'above', note:'trend up + VIX calm',
      conds:[{ label:'VIX z', now: z, op:'<', ref: 1.0, closed:true }, { label:'price>EMA200', ok: aboveTrend }] }]);
    if (aboveTrend && riskOn) return { side:'buy', qty: (ctx.cash / ctx.price) * 0.98 };
    return null;
  }

  const ep = ctx.entryPx;
  if (ep == null) return { side:'sell', qty: ctx.position, reduceOnly: true }; // unknown entry -> flatten safely
  const stop = atr != null ? ep - 2 * atr : ep * 0.9; // 2xATR hard stop caps every loss

  ctx.watch([
    { side:'sell', price: ema, trigger:'below', note:'trend break' },
    { side:'sell', price: stop, trigger:'below', note:'2xATR stop' }
  ]);
  if (prevClose < ema) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (atr != null && ctx.price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
