/*
 * @coinsori-strategy v1
 * name: ETH 4h BTC-Demand Trend
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin active addresses are a market-wide crypto demand proxy — when
 * BTC network usage expands, capital is flowing into crypto as a whole, and altcoins like
 * ETH ride the same flow. The validated BTC 4h on-chain demand edge is tested here on ETH:
 * same trend + demand + sentiment gates, different asset.
 * When it buys: EMA50 above EMA200 (uptrend) and BTC active addresses above their 30-day
 * average (market demand expanding) and Fear & Greed below 85 (not euphoric).
 * When it sells: trend flips down, or -20% hard stop below entry, or ATR de-risk cut.
 * When it does NOT work: BTC usage can expand while ETH-specific flows diverge, so ETH can
 * lag or fall even with BTC demand up; a liquidity pump with flat usage is missed; the hard
 * stop can be hit by a sharp intra-trend shakeout.
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
  const inPos = ctx.position > 0;
  const ratio = atrF / atrS;
  const falling = e50 < e50Prev;
  const deRisked = ctx.state.deRisked === true;
  const shouldDeRisk = ratio >= 2.2 && falling;
  const shouldRestore = ratio <= 1.5;
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
  const equity = ctx.cash + ctx.position * price;

  ctx.watch([
    { side:'buy', price: e200, trigger:'above', note:'uptrend + BTC demand up', conds:[
      { label:'F&G', now: fg, op:'<', ref: 85, closed:true },
      { label:'BTC addr>sma30', ok: demandUp }
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
      const diff = (equity / price) * 0.99 - ctx.position;
      if (diff > (equity / price) * 0.05) return { side:'buy', qty: diff * 0.99 };
    }
    return null;
  }
  if (up && fg < 85 && demandUp) {
    const qty = deRisked ? (equity / price) * 0.4 : (equity / price) * 0.99;
    return { side:'buy', qty: qty };
  }
  return null;
}
