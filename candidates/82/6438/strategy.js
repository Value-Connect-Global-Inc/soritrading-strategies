/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: When daily active Bitcoin addresses grow vs their own 30-day
 * average AND price is above its 100-day average, the network is in a healthy uptrend.
 * When it buys and sells: holds BTC only while both conditions hold; steps aside when
 * either breaks; keeps a 2.5xATR trailing stop.
 * When it does NOT work: choppy sideways markets flip the filter and fees eat small
 * moves; rallies without usage growth are missed.
 */
function onUpdate(ctx) {
  const s = ctx.state || {};
  const addrCur = ctx.data('addr');
  const addrSmaCur = ctx.data('addr_sma30');
  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  if (addrCur == null || addrSmaCur == null || sma100 == null || atr == null || prevClose == null) return null;

  // roll on-chain snapshot on bar change so we use the PREVIOUS closed day (no look-ahead)
  if (s.lastBarI !== ctx.i) {
    s.prevAddr = s.addr != null ? s.addr : null;
    s.prevAddrSma = s.addrSma != null ? s.addrSma : null;
    s.lastBarI = ctx.i;
  }
  s.addr = addrCur;
  s.addrSma = addrSmaCur;
  ctx.state = s;
  const addr = s.prevAddr;
  const addrSma = s.prevAddrSma;
  if (addr == null || addrSma == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const usageUp = addr > addrSma;
  const trendUp = prevClose > sma100;
  const inRegime = usageUp && trendUp;

  // trailing stop: 2.5xATR below highest price since entry
  if (pos > 0) {
    s.peak = Math.max(s.peak || (ctx.entryPx != null ? ctx.entryPx : price), price);
    ctx.state = s;
  } else {
    s.peak = null;
    ctx.state = s;
  }
  const stop = pos > 0 ? (s.peak - 2.5 * atr) : null;

  const watch = [];
  if (pos === 0) {
    watch.push({ side:'buy', price: sma100, trigger:'above', note:'trend up',
                 conds:[{ label:'usage>30d avg', ok: usageUp }] });
  } else {
    watch.push({ side:'sell', price: sma100, trigger:'below', note:'trend broke' });
    if (stop != null) watch.push({ side:'sell', price: stop, trigger:'below', note:'trailing stop 2.5ATR' });
  }
  ctx.watch(watch);

  if (pos > 0) {
    if (!inRegime || (stop != null && price < stop)) {
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (inRegime) {
    return { side:'buy', qty: ctx.cash / price * 0.99 };
  }
  return null;
}
