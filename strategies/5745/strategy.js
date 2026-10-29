/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/30 + Disaster Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Donchian-style breakout (buy a 55-bar close-high break, exit
 * on a 30-bar close-low break), sized by vol-target. This is the proven champion
 * recipe PLUS one addition: a hard 25% disaster stop so a single black-swan gap
 * cannot ride all the way to the 30-day low exit. It is pure risk control — it
 * does not change when we enter or how the normal trend exit works.
 * When it buys and sells: Buys when the previous close is higher than every close
 * of the previous 54 days, sized by vol-target (3% daily ATR = full). Sells on a
 * 30-day close-low break, OR immediately if price falls 25% below entry (disaster
 * stop, only meant for catastrophic moves).
 * When it does NOT work: In a long sideways range it whipsaws across the channel.
 * It lags sharp V-recoveries and underperforms buy-and-hold in calm choppy years.
 * The 25% stop rarely triggers in normal markets — it only protects against crashes.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const atr20 = ctx.atr(20, 1);
  if (atr20 == null || closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  // channel over the 54 CLOSED bars BEFORE prevClose (exclude index -2 = prevClose itself)
  let hi55 = -Infinity;
  for (let k = closes.length - 56; k < closes.length - 2; k++) {
    if (closes[k] > hi55) hi55 = closes[k];
  }
  let lo30 = Infinity;
  for (let k = closes.length - 31; k < closes.length - 2; k++) {
    if (closes[k] < lo30) lo30 = closes[k];
  }

  const pos = ctx.position;
  const entryPx = ctx.entryPx;

  if (pos > 0) {
    const disaster = (entryPx != null) ? entryPx * 0.75 : null; // 25% below entry
    const watch = [{ side: 'sell', price: lo30, trigger: 'below', note: 'break 30d close low' }];
    if (disaster != null) watch.push({ side: 'sell', price: disaster, trigger: 'below', note: '25% disaster stop' });
    ctx.watch(watch);
    if (prevClose < lo30) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (disaster != null && price <= disaster) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'break 55d close high' }]);

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > hi55) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct); // vol-target: 3% daily ATR = full position
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
