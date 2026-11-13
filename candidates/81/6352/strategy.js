/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Sized Trend Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage (daily unique active addresses) confirms whether a rally is real. Instead of a hard on/off gate (which blocked re-entry and missed the 2020-22 bull), this strategy SCALES position size with network activity: full size when addresses are above their 30-day average, tapered to 60% when they fall below. It keeps the proven ATR-calm trend core (enter calm, exit on volatility blowup or trend break).
 * When it buys and sells: buys when the previous bar closes above the 300-bar average and volatility is calm (ATR below 1.2x its 60-bar median), sized by the address ratio; sells when price closes below the 300-bar average, when ATR blows up past 2.2x its median, or when active addresses fall below 95% of their 30-day average.
 * When it does NOT work: in a derivatives-driven rally with flat on-chain usage the sizing taper reduces exposure and it underperforms holding. In a sustained high-volatility bull the calm filter keeps it flat. In long sideways chop the trend filter whipsaws.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma300 = ctx.sma(300, 1);
  if (sma300 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // On-chain: daily unique active addresses vs their own 30-day average (relative shape).
  const addr = ctx.data("main.addr");
  const addrSma = ctx.data("main.addr_sma30");
  if (addr == null || addrSma == null) { ctx.watch([]); return null; }
  const addrRatio = addr / addrSma;        // >1 network expanding, <1 contracting
  const addrCollapse = addrRatio < 0.95;   // exit: usage clearly drying up

  // ATR calm filter (proven core: enter only when calm, exit on vol blowup).
  const hist = ctx.state.atrHist || [];
  hist.push(atr);
  if (hist.length > 120) hist.shift();
  ctx.state.atrHist = hist;
  if (hist.length < 60) { ctx.watch([]); return null; }
  const sorted = [...hist].sort((a, b) => a - b);
  const median = sorted[Math.floor(sorted.length / 2)];
  const calm = atr < median * 1.2;
  const blowup = atr > median * 2.2;

  // Size by network activity: full when addresses above their 30d avg, taper to 60% when below.
  // Smooth, never zero — so we never fully miss a rally, just hold less during weak usage.
  const sizeFactor = Math.max(0.6, Math.min(1, addrRatio));

  const enterLvl = sma300 * 1.01;
  const exitLvl = sma300 * 0.99;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA300',
      conds: [
        { label: 'ATR calm', ok: calm },
        { label: 'addr/30d', now: Math.round(addrRatio * 100) / 100, op: '>', ref: 0.6 }
      ]
    }]);
    if (prevClose > enterLvl && calm) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 * sizeFactor };
    }
    return null;
  }

  ctx.watch([
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'below SMA300' },
    { side: 'sell', price: ctx.price, trigger: 'below', note: 'addr collapse',
      conds: [{ label: 'addr/30d', now: Math.round(addrRatio * 100) / 100, op: '<', ref: 0.95 }] }
  ]);
  if (prevClose < exitLvl || blowup || addrCollapse) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  return null;
}
