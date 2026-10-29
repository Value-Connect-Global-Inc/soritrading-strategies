/*
 * @coinsori-strategy v1
 * name: BTC Close-Channel 55/30 Breakout + Vol-Target 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Donchian-style breakout (buy a 55-bar close-high break, exit
 * on a 30-bar close-low break). The channel is built from CLOSE prices over the 54
 * bars BEFORE the previous close, so the previous close can genuinely break it.
 * Sized by vol-target to cut drawdown vs full-capital Donchian (ledger exp 547).
 * When it buys and sells: Buys when the previous close is higher than every close
 * of the previous 54 days, sized by vol-target (3% daily ATR = full). Sells when
 * the previous close is lower than every close of the previous 29 days.
 * When it does NOT work: In a long sideways range it whipsaws across the channel.
 * It lags sharp V-recoveries and underperforms buy-and-hold in calm choppy years.
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

  ctx.watch([
    { side: 'buy', price: hi55, trigger: 'above', note: 'break 55d close high' },
    { side: 'sell', price: lo30, trigger: 'below', note: 'break 30d close low' }
  ]);

  if (pos > 0) {
    if (prevClose < lo30) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > hi55) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct);
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
