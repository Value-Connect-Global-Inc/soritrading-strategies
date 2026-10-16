/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The crypto Fear & Greed Index is a sentiment thermometer — extreme fear
 * (index < 25) has historically marked panic-selling bottoms, and extreme greed (index > 70)
 * has marked euphoric tops. This strategy buys the panic and sells the euphoria.
 * When it buys and sells: buys BTC when the Fear & Greed Index closes below 25. Sells when the
 * index closes above 70, or on a -15% hard stop to cap a falling-knife loss.
 * When it does NOT work: extreme fear can persist for months in a true bear market, so the
 * -15% stop exits at a loss repeatedly. If the index never reaches 70 in a muted rally, the
 * position sits and gives back gains. Needs the fear_greed dataset connected.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const fg = ctx.data('fear_greed');
  if (fg == null) return null; // sentiment data not available yet — wait, never treat null as 0
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx * 0.85; // -15% hard stop caps falling-knife loss
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (fg >= 70) return { side: 'sell', qty: pos }; // extreme greed = sell euphoria
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '-15% hard stop' },
               { side: 'sell', price: null, note: 'FG>=70 greed exit',
                 conds: [{ label: 'FG index', now: fg, op: '>=', ref: 70, closed: true }] }]);
    return null;
  }

  if (fg < 25) {
    const qty = ctx.cash * 0.9 / price;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', price: null, note: 'FG extreme fear entry',
                 conds: [{ label: 'FG index', now: fg, op: '<', ref: 25, closed: true }] }]);
    return { side: 'buy', qty };
  }

  ctx.watch([{ side: 'buy', price: null, note: 'FG extreme fear entry',
               conds: [{ label: 'FG index', now: fg, op: '<', ref: 25, closed: true }] }]);
  return null;
}
