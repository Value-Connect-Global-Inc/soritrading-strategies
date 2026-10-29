/*
 * @coinsori-strategy v1
 * name: Multi-Sym Donchian 55/30 Portfolio 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The proven single-symbol Donchian 55/30 + vol-target edge
 * (champion 5736/5745 on BTC) applied to a diversified basket of BTC, ETH and SOL.
 * Bet: trend breakouts persist in crypto majors; running the same edge on three
 * correlated-but-distinct assets spreads the single-asset crash risk so one coin's
 * drawdown does not sink the whole account.
 * When it buys and sells: on each symbol, buys when the previous close breaks its
 * 55-day close high, sized by vol-target (3% daily ATR = full budget for that coin).
 * Sells on a 30-day close-low break, or immediately if price falls 25% below entry.
 * When it does NOT work: in a long sideways range it whipsaws across the channel,
 * and crypto majors are correlated so a broad crypto winter hits all three at once —
 * diversification reduces but does not remove the crash risk.
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
    // size off THIS symbol's available cash; the engine's multi-symbol cash
    // accounting splits the pool and rejects orders that exceed available cash
    const budget = 0.99 * ctx.cash;
    const qty = (0.99 * budget * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
