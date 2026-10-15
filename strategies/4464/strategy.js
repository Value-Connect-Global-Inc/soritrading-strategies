/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian Reversion (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crowd fear marks short-term panic bottoms in Bitcoin —
 * when the Fear & Greed index is at extreme fear, sellers are exhausted and
 * a mean-reversion bounce is more likely than continued collapse. We buy
 * panic and sell euphoria.
 * When it buys and sells: buys when the index is <= 25 (panic zone). Sells
 * when the index is >= 80 (euphoria), the close drops below the 20-day EMA,
 * or a 20% hard stop is hit.
 * When it does NOT work: in a sustained bear market the index can sit in
 * extreme fear for months while price keeps falling — each buy is a falling
 * knife. The EMA20 exit bounds the loss but the strategy bleeds in a long
 * downtrend with no recovery bounces.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fg');
  if (fg == null) return null;   // no sentiment data → do nothing, never guess

  const c = ctx.closes;
  if (c.length < 22) return null;
  const prevClose = c.at(-2);

  const ema20 = ctx.ema(20, 1);
  if (ema20 == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.80;   // hard stop: 20% below entry (panic buys are knives)
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema20) return { side: 'sell', qty: pos };   // bounce failed, cut it
    if (fg >= 80) return { side: 'sell', qty: pos };            // euphoria → take profit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: ema20, trigger: 'below', note: 'bounce failed (below EMA20)',
                 conds: [{ label: 'FG index', now: fg, op: '<', ref: 80, closed: true }] },
               { side: 'sell', price: 80, trigger: 'above', note: 'FG >= 80 euphoria',
                 conds: [{ label: 'FG index', now: fg, op: '>=', ref: 80, closed: true }] }]);
    return null;
  }

  ctx.watch([{ side: 'buy', price: 25, trigger: 'below', note: 'FG <= 25 panic',
               conds: [{ label: 'FG index', now: fg, op: '<=', ref: 25, closed: true }] }]);
  if (fg > 25) return null;   // only buy in the panic zone

  // half position: counter-trend entries are risky, size them down
  const qty = (ctx.cash / price) * 0.50;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
