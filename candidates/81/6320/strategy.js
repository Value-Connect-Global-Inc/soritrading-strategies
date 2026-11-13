/*
 * @coinsori-strategy v1
 * name: BTC VIX-Regime Long/Short 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: BTC trends persist in both directions on 4h, and the worst losses
 * cluster in risk-off episodes when the VIX spikes far above its own recent
 * mean. A long-only version of this idea failed to beat buy-and-hold, so
 * this version rides the trend BOTH ways: long above the 200 EMA, short
 * below it, while refusing to open fresh positions into a VIX panic.
 * Buy when price closes above the 200 EMA and the VIX z-score is calm; sell
 * short when price closes below the 200 EMA and the VIX is calm. Every
 * position carries a 2xATR hard stop and is flattened when the trend flips.
 * Does not work in a choppy sideways market with no sustained trend (many
 * small whipsaws) or when the VIX stays pinned high for months (we stay
 * flat through a real rally or crash).
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
  const riskOn = z < 1.0; // entry gate: do not open a fresh position into a VIX panic
  const atr = ctx.atr(14, 1);
  const pos = ctx.position;

  if (pos === 0) {
    const up = prevClose > ema;
    const dn = prevClose < ema;
    ctx.watch([
      { side:'buy', price: ema, trigger:'above', note:'long trend up',
        conds:[{ label:'VIX z', now: z, op:'<', ref: 1.0, closed:true }, { label:'price>EMA200', ok: up }] },
      { side:'sell', price: ema, trigger:'below', note:'short trend down',
        conds:[{ label:'VIX z', now: z, op:'<', ref: 1.0, closed:true }, { label:'price<EMA200', ok: dn }] }
    ]);
    if (up && riskOn) return { side:'buy', qty: (ctx.cash / ctx.price) * 0.98 };
    if (dn && riskOn) return { side:'sell', qty: (ctx.cash / ctx.price) * 0.98 };
    return null;
  }

  const ep = ctx.entryPx;
  if (ep == null) { // unknown entry -> flatten safely
    return pos > 0
      ? { side:'sell', qty: pos, reduceOnly: true }
      : { side:'buy', qty: -pos, reduceOnly: true };
  }

  if (pos > 0) {
    const stop = atr != null ? ep - 2 * atr : ep * 0.9; // 2xATR hard stop caps every long loss
    ctx.watch([
      { side:'sell', price: ema, trigger:'below', note:'trend break' },
      { side:'sell', price: stop, trigger:'below', note:'2xATR stop' }
    ]);
    if (prevClose < ema) return { side:'sell', qty: pos, reduceOnly: true };
    if (atr != null && ctx.price <= stop) return { side:'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const stop = atr != null ? ep + 2 * atr : ep * 1.1; // 2xATR hard stop caps every short loss
  ctx.watch([
    { side:'buy', price: ema, trigger:'above', note:'trend break' },
    { side:'buy', price: stop, trigger:'above', note:'2xATR stop' }
  ]);
  if (prevClose > ema) return { side:'buy', qty: -pos, reduceOnly: true };
  if (atr != null && ctx.price >= stop) return { side:'buy', qty: -pos, reduceOnly: true };
  return null;
}
