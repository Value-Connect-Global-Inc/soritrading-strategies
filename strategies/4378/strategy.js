/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian Dip Buyer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment swings to extremes. When the Fear & Greed
 *   index hits extreme fear (<=20), the crowd is panicking — historically a good
 *   entry. We buy the panic and ride the recovery with a trailing stop, so a
 *   real bull run is captured in full instead of being cut short.
 * When it buys and sells: buy BTC when the Fear & Greed index drops to <=20.
 *   Sell when price falls 20% below its highest close since entry, or when a
 *   2.5x ATR hard stop hits. No greed-based exit, so winners can run.
 * When it does NOT work: in a long grinding bear market the index keeps hitting
 *   extreme fear and each dip-buy loses a little (the stop caps each loss but
 *   repeated whipsaws add up). It also misses slow steady bulls that never show
 *   extreme fear. This is a mean-reversion bet, not a trend bet.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const atr = ctx.atr(14, 1);
  if (fg == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const peak = Math.max(ctx.state.peak || prevClose, prevClose);
    ctx.state.peak = peak;
    const trailStop = peak * 0.80;
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (price <= trailStop) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing -20%' }]);
    return null;
  }

  if (fg > 20) return null;

  const riskCash = ctx.cash * 0.01;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
