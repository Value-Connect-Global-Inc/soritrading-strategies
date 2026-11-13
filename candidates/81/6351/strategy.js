/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Trend Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's network usage (daily unique active addresses) tends to expand during real rallies and contract before breakdowns. This rides a proven 300-bar uptrend with a volatility-calm entry filter, and adds one independent confirmation: it only enters when on-chain activity is expanding (addresses above their own 30-day average) and exits early when activity collapses. Network usage is a different data family (on-chain) than price, rates or sentiment.
 * When it buys and sells: buys when the previous bar closes above the 300-bar average, volatility is calm (ATR below 1.2x its 60-bar median) AND active addresses are above their 30-day average; sells when price closes below the 300-bar average, when ATR blows up past 2.2x its median, or when active addresses fall below 95% of their 30-day average.
 * When it does NOT work: in a price rally not backed by growing on-chain usage (e.g. a derivatives-driven squeeze) the address filter keeps it flat and it misses the move. In a sustained high-volatility bull the calm filter also keeps it flat. In long sideways chop the trend filter whipsaws.
 */
function onUpdate(ctx) {
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const sma300 = ctx.sma(300, 1);
  if (sma300 == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null) return null;

  // On-chain: daily unique active addresses vs their own 30-day average (relative, not a fixed level).
  const addr = ctx.data("main.addr");
  const addrSma = ctx.data("main.addr_sma30");
  if (addr == null || addrSma == null) { ctx.watch([]); return null; }
  const addrRatio = addr / addrSma;        // >1 network expanding, <1 contracting
  const addrGrowing = addrRatio > 1.0;     // entry gate: usage above its recent norm
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

  const enterLvl = sma300 * 1.01;
  const exitLvl = sma300 * 0.99;

  if (ctx.position <= 0) {
    ctx.watch([{
      side: 'buy', price: enterLvl, trigger: 'above', note: 'above SMA300',
      conds: [
        { label: 'ATR calm', ok: calm },
        { label: 'addr>30d avg', ok: addrGrowing }
      ]
    }]);
    if (prevClose > enterLvl && calm && addrGrowing) {
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
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
