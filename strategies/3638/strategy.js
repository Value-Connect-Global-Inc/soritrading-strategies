/*
 * @coinsori-strategy v1
 * name: MacroDxyTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC behaves like a risk asset — when the US dollar weakens
 * (Dollar Index below 100), risk assets tend to rally; when the dollar firms up,
 * crypto tends to stall or fall. We only take long trends while the dollar regime
 * is supportive.
 * When it buys and sells: buys when price is above both the 200-day and 50-day
 * averages AND the Dollar Index is below 100. Sells when price closes below the
 * 50-day average, or when the Dollar Index rises above 100 (regime turns against).
 * When it does NOT work: periods where crypto decouples from the dollar (e.g. its own
 * adoption/regulatory news cycles), and choppy sideways markets that whipsaw the trend.
 */
function onUpdate(ctx) {
  const s200 = ctx.sma(200, 1);
  const s50 = ctx.sma(50, 1);
  const dxy = ctx.data('dxy');
  if (s200 == null || s50 == null || dxy == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const price = ctx.price;
  const weakDollar = dxy < 100;   // pre-specified regime level, not fitted

  if (ctx.position <= 0) {
    // Entry: confirmed uptrend AND weak-dollar regime.
    if (prevClose > s200 && prevClose > s50 && weakDollar) {
      ctx.watch([
        { side: 'sell', price: s50, trigger: 'below', note: 'momentum break' },
        { side: 'sell', price: price * 1.5, trigger: 'above', note: 'profit target' }
      ]);
      return { side: 'buy', qty: (ctx.cash * 0.5) / price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'trend entry', conds: [
      { label: 'Close > SMA200', ok: prevClose > s200, closed: true },
      { label: 'Close > SMA50', ok: prevClose > s50, closed: true },
      { label: 'DXY < 100', now: dxy, op: '<', ref: 100, closed: true }
    ] }]);
    return null;
  }

  // Exit on momentum break below SMA50, or dollar regime turning strong (DXY>=100).
  if (prevClose < s50 || dxy >= 100) {
    ctx.watch([]);
    return { side: 'sell', qty: ctx.position };
  }
  ctx.watch([
    { side: 'sell', price: s50, trigger: 'below', note: 'momentum break' },
    { side: 'sell', price: ctx.entryPx * 1.5, trigger: 'above', note: 'profit target' }
  ]);
  return null;
}
