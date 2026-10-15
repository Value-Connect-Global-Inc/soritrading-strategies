/*
 * @coinsori-strategy v1
 * name: RSI Mean Reversion (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Short-term overreaction to the downside tends to revert.
 * In an uptrend (price above its 200-day average) an oversold RSI reading marks
 * a dip worth buying, not a new bear market. This is the mean-reversion family,
 * the opposite of the trend-following Donchian champion — it buys weakness
 * instead of strength, so it makes money in a different regime.
 * When it buys and sells: buys when RSI(14) < 30 AND close is above the 200-day
 * average. Sells when RSI(14) climbs back above 50, or a 15% hard stop, or 20
 * days without a recovery.
 * When it does NOT work: in a real bear market the 200-day filter keeps it in
 * cash mostly, but if the filter is breached while holding, the 15% stop takes
 * a hit; in a long grinding downtrend RSI stays low and it never buys, missing
 * nothing but also earning nothing.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 210) return null; // need 200 for the trend filter + RSI warmup

  const prevClose = closes[n - 2];
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    // exit: RSI recovered above 50, hard stop, or 20-day time stop
    const rsi = ctx.rsi(14, 1);
    if (rsi != null && rsi > 50) return { side: 'sell', qty: pos };
    const stop = ctx.entryPx * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    const held = ctx.state.entryI != null ? ctx.i - ctx.state.entryI : 0;
    if (held >= 20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ctx.entryPx, trigger: 'above', note: 'RSI>50 exit',
                 conds: [{ label: 'RSI(14) close', now: rsi != null ? rsi : 0, op: '>', ref: 50, closed: true }] }]);
    return null;
  }

  // only buy oversold dips inside an uptrend — never catch a falling knife
  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;
  const oversold = rsi < 30;
  const trendUp = prevClose > sma200;
  const enter = oversold && trendUp;

  ctx.watch([{ side: 'buy', price: sma200 * 0.9, trigger: 'below', note: 'RSI<30 + uptrend dip',
               conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
                       { label: 'close > SMA200', ok: trendUp, closed: true }] }]);
  if (!enter) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  ctx.state.entryI = ctx.i;
  return { side: 'buy', qty };
}
