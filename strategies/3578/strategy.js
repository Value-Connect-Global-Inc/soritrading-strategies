/*
 * @coinsori-strategy v1
 * name: BTC 1D Hashrate Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin mining hashrate is a slow, persistent measure of
 *   network commitment. When hashrate runs above its 30-day average, miners
 *   are expanding — historically a backdrop in which BTC price trends up.
 *   When hashrate rolls over, price tends to follow.
 * When it buys and sells: buy when hashrate is above its 30-day average AND
 *   price is above its 50-day average; sell when price closes below its 50-day
 *   average, when hashrate falls back below its 30-day average, or on a 3x ATR
 *   stop.
 * When it does NOT work: hashrate lags price, so in fast crashes the strategy
 *   still takes the drawdown before hashrate rolls over. In sideways markets
 *   with stable hashrate it trades in and out repeatedly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const ema50 = ctx.ema(50, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (hr == null || hrSma == null || ema50 == null || sma50 == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 3 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };     // hard stop
    if (price < ema50) return { side: 'sell', qty: pos };       // trend broken
    if (hr < hrSma) return { side: 'sell', qty: pos };          // hashrate rolled over
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  if (hr <= hrSma) return null;   // miners contracting — no longs
  if (price <= sma50) return null; // still falling — don't catch the knife

  const riskCash = ctx.cash * 0.01;      // 1% equity risked per trade
  const stopDist = 3 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap position at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
