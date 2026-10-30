/*
 * @coinsori-strategy v1
 * name: BTC OnChain Adoption 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On-chain adoption signal. Rising daily active addresses mean real
 * network usage is growing — a fundamental driver that price alone does not see. Buying
 * when usage is above its 30-day average while price holds above its 200-day average
 * aligns with organic demand rather than speculation.
 * When it buys and sells: Buys BTC when active addresses > their 30-day average AND price
 * is above the 200-day average. Sells when price closes below the 200-day average or on a
 * hard 2.5-ATR stop.
 * When it does NOT work: On-chain usage can stay high during a distribution top (usage is
 * not the same as accumulation), and the 200-day gate means it misses the early bottom.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || sma200 == null) return null;

  const pos = ctx.pos(ctx.sym);
  const entry = ctx.entryPx;
  if (pos > 0) {
    const stop = entry != null && entry > 0 ? entry - 2.5 * atr : null;
    const watchList = [{ side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 exit' }];
    if (stop != null) watchList.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard 2.5 ATR stop' });
    ctx.watch(watchList);
    if (price < sma200) return { side: 'sell', qty: pos, reduceOnly: true };
    if (stop != null && price < stop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  if (addr == null || addrSma == null) return null;
  if (addr > addrSma && price > sma200) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
