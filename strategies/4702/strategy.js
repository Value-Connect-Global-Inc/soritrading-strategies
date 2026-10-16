/*
 * @coinsori-strategy v1
 * name: BTC Donchian F&G Risk-On 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Donchian breakouts (55-bar high entry, 20-bar low exit) are the strongest
 * family tested on BTC 1d in this ledger. This adds a sentiment regime gate: breakouts are more
 * reliable when the crypto Fear & Greed index is in its risk-on half (greed >= 50) because the
 * breakout is backed by genuine risk appetite, not a dead-cat bounce in a fear regime.
 * When it buys and sells: buys when a closed daily bar breaks the 55-bar high AND Fear & Greed is
 * at or above 50 (risk-on sentiment). Sells on a 2x ATR hard stop or when a closed bar breaks the
 * 20-bar low.
 * When it does NOT work: in choppy sideways markets the 55-bar breakout whipsaws; in a fear-driven
 * rally the gate blocks entries so it misses the early move; if the Fear & Greed data is missing it
 * stays flat.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // sentiment unknown -> stay flat

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));

  const NB = c.length - 2;
  const prevClose = c.at(-2);
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  const riskOn = fg >= 50; // sentiment in risk-on half
  if (!(prevClose > h55 && riskOn)) {
    ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
                 conds: [{ label: 'F&G risk-on', now: fg, op: '>=', ref: 50, closed: true }] }]);
    return null;
  }

  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.02 / atrPct);
  const qty = (ctx.cash * 0.95 * volScale) / price * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar breakout in risk-on' }]);
  return { side: 'buy', qty };
}
