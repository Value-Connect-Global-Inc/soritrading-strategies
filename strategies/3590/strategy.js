/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Fear & Greed index is a crowd sentiment barometer.
 *   Crypto crowds panic at bottoms and turn euphoric at tops; buying when the
 *   crowd is in extreme fear and selling when it is in extreme greed is a
 *   mean-reversion bet on that cycle — the opposite family from the
 *   trend-following turtle already in the portfolio.
 * When it buys and sells: buys BTC when the Fear & Greed index is at or below
 *   25 (extreme fear). Sells when it reaches 75+ (extreme greed), or on a 30%
 *   crash stop, or after holding 150 days without either trigger.
 * When it does NOT work: in a prolonged bear market fear stays extreme for
 *   months, so it buys early and either bleeds through the time stop or is
 *   stopped out repeatedly; in a slow grind higher with no panic it never
 *   enters and sits in cash.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  if (fg == null) return null;          // no sentiment data yet — stay in cash
  const price = ctx.price;

  if (ctx.position > 0) {
    const entryBar = ctx.state.entryBar != null ? ctx.state.entryBar : ctx.i;
    const held = ctx.i - entryBar;
    const stopPx = ctx.entryPx * 0.70;  // 30% crash stop — wide on purpose, catastrophic-risk only
    if (fg >= 75 || price <= stopPx || held >= 150) {
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([
      { side: 'sell', price: stopPx, trigger: 'below', note: '30% crash stop' },
      { side: 'sell', note: 'greed exit', conds: [{ label: 'Fear&Greed', now: fg, op: '>=', ref: 75 }] }
    ]);
    return null;
  }

  // buy only at extreme fear; risk 5% of the account with a 30% stop → ~17% position
  if (fg <= 25) {
    const riskCash = ctx.cash * 0.05;
    const stopDist = price * 0.30;
    let qty = stopDist > 0 ? riskCash / stopDist : 0;
    const maxQty = (ctx.cash * 0.99) / price;
    if (qty > maxQty) qty = maxQty;
    if (qty <= 0) return null;
    ctx.state.entryBar = ctx.i;
    ctx.watch([
      { side: 'buy', note: 'extreme fear entry', conds: [{ label: 'Fear&Greed', now: fg, op: '<=', ref: 25 }] },
      { side: 'sell', price: price * 0.70, trigger: 'below', note: '30% crash stop' }
    ]);
    return { side: 'buy', qty };
  }
  return null;
}
