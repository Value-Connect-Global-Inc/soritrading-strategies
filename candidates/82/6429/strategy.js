/*
 * @coinsori-strategy v1
 * name: BTC 1H Volatility-Range Mean Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 1h
 * cash: 1000
 *
 * Why this strategy: Bitcoin on 1h often reverts to its short mean after sharp
 * moves, and a volatility regime filter keeps us out of choppy/quiet sideways.
 * When it buys and sells: buy when price drops far below the 20-bar mean and
 * volatility (ATR) is elevated (a panic dip), sell when price snaps back up to
 * the mean. Always carry a hard stop below entry.
 * When it does NOT work: strong one-way trends (no reversion), and very low
 * volatility regimes where the dip is just noise. A hard stop caps the loss.
 */
function onUpdate(ctx) {
  ctx.watch([]);
  const price = ctx.price;
  const sma = ctx.sma(20, 1);
  const atr = ctx.atr(14, 1);
  const z = ctx.zscore(20, 1);
  if (sma == null || atr == null || z == null) return null;

  // Volatility filter: only trade when ATR is elevated relative to price
  // (a real panic move), so we don't catch noise in calm markets.
  const atrPct = atr / price;
  if (atrPct < 0.003) return null;

  const qty = (ctx.cash / price) * 0.5;

  if (ctx.position === 0) {
    // Enter on a sharp oversold dip below the mean.
    if (z < -2.2) {
      ctx.watch([{ side:'buy', price: price, trigger:'below', note:'panic dip' }]);
      return { side:'buy', qty: qty };
    }
    return null;
  }

  // Exit: revert back up to the mean, or hard stop to cap the loss.
  const stop = ctx.entryPx != null ? ctx.entryPx * 0.97 : null;
  const tp = sma;
  ctx.watch([
    { side:'sell', price: tp, trigger:'above', note:'revert to mean' },
    { side:'sell', price: stop, trigger:'below', note:'hard stop' }
  ]);
  if (price >= tp) return { side:'sell', qty: ctx.position, reduceOnly: true };
  if (stop != null && price <= stop) return { side:'sell', qty: ctx.position, reduceOnly: true };
  return null;
}
