/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Adoption Trend 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * On-chain fundamentals, not price momentum: buy BTC when the network is
 * actually being used more (daily active addresses above their 30-day
 * average, i.e. adoption expanding) AND price is above its 200-EMA.
 * When it buys and sells: LONG when main.addr > main.addr_sma30 (usage
 * above its 30-day norm) and close > EMA200; exit on a close below EMA200
 * or a 3xATR stop. It holds through adoption expansion and steps aside
 * when usage stalls or the trend flips.
 * When it does NOT work: active addresses are a lagging, weekly-cycle
 * measure — in a fast speculative bull (2021, 2024 ETF rally) usage can
 * lag price and the strategy enters late or misses the move; in a bear,
 * price can fall while addresses stay elevated for weeks.
 */
function onUpdate(ctx) {
  const addr = ctx.data('main.addr');
  const addrSma = ctx.data('main.addr_sma30');
  const ema200 = ctx.ema(200, 1);
  const atr = ctx.atr(14, 1);
  if (addr == null || addrSma == null || ema200 == null || atr == null) {
    ctx.watch([]);
    return null;
  }
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;

  const prevPos = ctx.state.lastPos || 0;
  if (prevPos !== 0 && pos === 0) ctx.state.skipUntil = ctx.i + 6;
  ctx.state.lastPos = pos;

  if (pos > 0) {
    const stop = (entryPx != null ? entryPx : price) - 3 * atr;
    ctx.watch([
      { side: 'sell', price: ema200, trigger: 'below', note: 'close < EMA200' },
      { side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' }
    ]);
    if (prevClose != null && prevClose < ema200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  const alloc = ctx.alloc;
  let forcedRecent = false;
  if (alloc != null && alloc.lastForced != null) {
    const lf = alloc.lastForced;
    if (typeof lf === 'number') {
      const nowT = ctx.times.at(-1) || 0;
      const nowI = ctx.i;
      const lfSec = lf > 1e12 ? lf / 1000 : lf;
      if (Math.abs(lfSec - nowT) < 6 * 4 * 3600) forcedRecent = true;
      else if (lf >= nowI - 6 && lf <= nowI) forcedRecent = true;
    } else if (ctx.state._forcedSeen == null) ctx.state._forcedSeen = ctx.i;
  }
  if (ctx.state._forcedSeen != null && ctx.i - ctx.state._forcedSeen <= 6) forcedRecent = true;
  const afterForced = forcedRecent || (ctx.state.skipUntil != null && ctx.i <= ctx.state.skipUntil);
  const allocOk = (alloc == null || alloc.status === 'ok') && !afterForced;
  if (!allocOk) { ctx.watch([]); return null; }

  const uptrend = prevClose != null && prevClose > ema200;
  const adoptionUp = addr > addrSma; // daily usage above its 30-day norm = expanding
  ctx.watch([
    { side: 'buy', price: ema200, trigger: 'above', note: 'long', conds: [{ label: 'addr>addrSma30', ok: adoptionUp }] }
  ]);
  if (!(uptrend && adoptionUp)) return null;
  const stopDist = 3 * atr;
  const riskCash = ctx.cash * 0.02;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
