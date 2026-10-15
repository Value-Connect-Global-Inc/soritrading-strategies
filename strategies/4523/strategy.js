/*
 * @coinsori-strategy v1
 * name: Contrarian Fear-Greed (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The F&G champion (4516) follows sentiment — buys on
 * greed. This is the OPPOSITE bet: crowd panic (extreme fear) historically
 * marks good long entries, and crowd euphoria (greed) marks exits. It is a
 * sentiment mean-reversion hypothesis, not a momentum one.
 * When it buys and sells: buys when F&G <= 20 (extreme fear). Sells when F&G
 * >= 60 (greed) or a 25% hard stop is hit.
 * When it does NOT work: in a sustained bear market fear stays low for months
 * and the stop keeps cutting losses — the strategy bleeds. Extreme fear is
 * only a good entry when it is a dip in an uptrend, which this version does
 * not check.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // unknown sentiment = stay flat

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75; // hard stop 25% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fg >= 60) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% stop' },
               { side: 'sell', price: 60, trigger: 'above', note: 'exit: F&G >= 60',
                 conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 60, closed: true }] }]);
    return null;
  }

  ctx.watch([{ side: 'buy', price: 20, trigger: 'below', note: 'enter: F&G <= 20',
               conds: [{ label: 'F&G index', now: fg, op: '<=', ref: 20, closed: true }] }]);
  if (!(fg <= 20)) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
