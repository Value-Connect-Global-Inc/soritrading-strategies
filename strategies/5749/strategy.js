/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/30 + VIX Gate 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The proven champion (Donchian 55/30 breakout + vol-target
 * sizing + 25% disaster stop) plus ONE new entry gate from a different signal
 * family: the CBOE VIX (equity-market fear index). Crypto draws down hardest
 * when global risk appetite collapses, which the VIX sees before BTC's own
 * channel does. The gate only blocks NEW entries during a VIX panic (>30); it
 * never changes the exit logic or sizing.
 * When it buys and sells: Buys when the previous close breaks the 55-day close
 * high AND the VIX is below 30 (not in a panic). Sells on a 30-day close-low
 * break, or immediately if price falls 25% below entry (disaster stop).
 * When it does NOT work: Same whipsaw risk as the champion in sideways ranges.
 * The VIX gate adds a few days of lag to re-entry after a panic, so it can miss
 * the very first bounce of a V-recovery. It does nothing in calm regimes where
 * the VIX is already low — there it simply behaves like the champion.
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
    const vix = ctx.data('base_vix');
    // VIX gate: block new entries during an equity panic. Fail-open if VIX data missing.
    if (vix != null && vix > 30) return null;
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct); // vol-target: 3% daily ATR = full position
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
