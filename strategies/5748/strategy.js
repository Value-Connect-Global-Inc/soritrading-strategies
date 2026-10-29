/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/30 + Drawdown De-Risk 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The proven Donchian 55/30 + vol-target breakout (champion 5736)
 * plus ONE risk overlay: when the account is in a drawdown from its equity peak, the
 * position size is cut. Bet: the champion's main weakness is holding a full vol-target
 * position through a crash while the slow 30-day exit catches up. Shrinking size after
 * a loss is a general survival rule that works in any regime, not fitted to one crash.
 * When it buys and sells: buys on a 55-day close-high break, sized by vol-target
 * (3% daily ATR = full), then scaled DOWN by the drawdown multiplier. Sells on a
 * 30-day close-low break. The drawdown multiplier only shrinks size, never forces exits.
 * When it does NOT work: after a big drawdown it stays under-invested and can miss the
 * sharpest rebound. In a choppy range it whipsaws like any channel breakout.
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

  // track equity peak in restart-surviving state
  const st = ctx.state.st || { peak: null };
  const equity = ctx.cash + pos * price;
  if (st.peak == null || equity > st.peak) st.peak = equity;
  ctx.state.st = st;

  // drawdown multiplier: full size until -10%, half until -25%, quarter beyond
  const dd = equity / st.peak - 1;
  let ddScale = 1;
  if (dd < -0.25) ddScale = 0.25;       // deep drawdown: trade at quarter size
  else if (dd < -0.10) ddScale = 0.5;   // moderate drawdown: trade at half size

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: lo30, trigger: 'below', note: 'break 30d close low' }]);
    if (prevClose < lo30) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'break 55d close high' }]);

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > hi55) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct) * ddScale; // vol-target scaled by drawdown
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
