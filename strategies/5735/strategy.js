/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/30 + 2xATR Trailing Stop 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Donchian-style breakout (buy a 55-bar close-high break, exit on a
 * 30-bar close-low break). The channel is built from CLOSE prices over the 54 bars BEFORE
 * the previous close, so the previous close can genuinely break it. Sized by vol-target
 * (3% daily ATR = full) to cut drawdown vs full-capital Donchian. A 2xATR trailing stop
 * locks in gains so a strong trend is not given all the way back to the 30-day low.
 * When it buys and sells: Buys when the previous close is higher than every close of the
 * previous 54 days. Sells when price falls 2xATR below its peak since entry, OR when the
 * previous close is lower than every close of the previous 29 days (whichever first).
 * When it does NOT work: In a long sideways range it whipsaws across the channel and the
 * trailing stop exits on normal noise. It lags sharp V-recoveries and underperforms
 * buy-and-hold in calm choppy years.
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
  const trail = (ctx.state && ctx.state.trail) ? ctx.state.trail : null;

  if (pos > 0) {
    const peak = (trail && trail.peak > price) ? trail.peak : price;
    const stop = peak - 2 * atr20; // 2xATR trailing: standard trend-following give-back control
    ctx.state = { trail: { peak: peak } };
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: '2xATR trailing stop' },
      { side: 'sell', price: lo30, trigger: 'below', note: 'break 30d close low' }
    ]);
    if (price < stop || prevClose < lo30) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (trail) ctx.state = {}; // flat: clear trailing state

  ctx.watch([
    { side: 'buy', price: hi55, trigger: 'above', note: 'break 55d close high' }
  ]);

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
