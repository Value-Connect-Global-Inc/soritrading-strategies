/*
 * @coinsori-strategy v1
 * name: BTC 4h Onchain Demand Size
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Same proven on-chain demand trend ride as the champion, but position
 * size scales with demand strength — the further daily active addresses run above their
 * 30-day average, the more we commit. A binary filter wastes conviction: a barely-above-
 * average usage day gets the same full position as a strong usage expansion. Sizing by the
 * demand ratio concentrates capital in the healthiest phases.
 * When it buys: EMA50 above EMA200 and active addresses above their 30-day average and
 * Fear & Greed below 85; size grows from 50% to ~100% as the demand ratio climbs 1.0 to 1.5.
 * When it sells: trend flips down, -20% hard stop, or ATR de-risk cut.
 * When it does NOT work: choppy ranges where addresses hover near their average make the
 * filter flicker and size small; a liquidity pump with flat usage is missed entirely; the
 * hard stop can be hit by a sharp intra-trend shakeout.
 */
function onUpdate(ctx) {
  const e50 = ctx.ema(50, 1);
  const e200 = ctx.ema(200, 1);
  if (e50 == null || e200 == null) return null;
  const atrF = ctx.atr(14, 1);
  const atrS = ctx.atr(100, 1);
  if (atrF == null || atrS == null) return null;
  const e50Prev = ctx.ema(50, 6);
  if (e50Prev == null) return null;
  const fg = ctx.data('fear_greed');
  const addr = ctx.data('addr');
  const addrS = ctx.data('addr_sma30');
  if (fg == null || addr == null || addrS == null) return null;

  const price = ctx.price;
  const up = e50 > e200;
  const demandUp = addr > addrS;
  // demand strength: how far current usage runs above its 30-day average (1.0 = average)
  const demandRatio = addr / addrS;
  // size 50%->~100% as the ratio climbs 1.0->1.5 (full strength = full commitment)
  const strength = Math.max(0, Math.min(1, (demandRatio - 1.0) / 0.5));
  const sizeMult = 0.5 + 0.5 * strength;
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS;
  const falling = e50 < e50Prev;
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2 && falling;
  const shouldRestore = ratio <= 1.5;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
  const equity = ctx.cash + ctx.position * price;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + demand up', conds:[
      { label:'F&G', now: fg, op:'<', ref: 85, closed:true },
      { label:'addr>sma30', ok: demandUp },
      { label:'demand ratio', now: demandRatio, op:'>', ref: 1.0, closed:true }
    ]},
    ...(inPos ? [
      { side:'sell', price: e200, trigger:'below', note:'trend broke' },
      { side:'sell', price: stop, trigger:'below', note:'hard stop' }
    ] : [])
  ]);

  if (inPos && ctx.entryPx != null) {
    if (price <= stop) { ctx.state.deRisked = false; return { side:'sell', qty: ctx.position, reduceOnly: true }; }
    if (!up) { ctx.state.deRisked = false; return { side:'sell', qty: ctx.position, reduceOnly: true }; }
    if (!deRisked && shouldDeRisk) {
      ctx.state.deRisked = true;
      const diff = ctx.position - (equity / price) * 0.4;
      if (diff > (equity / price) * 0.05) return { side:'sell', qty: diff * 0.99, reduceOnly: true };
    } else if (deRisked && shouldRestore) {
      ctx.state.deRisked = false;
      const target = (equity / price) * sizeMult;
      const diff = target - ctx.position;
      if (diff > (equity / price) * 0.05) return { side:'buy', qty: diff * 0.99 };
    }
    return null;
  }
  if (up && fg < 85 && demandUp) {
    const qty = deRisked ? (equity / price) * 0.4 : (equity / price) * sizeMult;
    return { side:'buy', qty: qty };
  }
  return null;
}
