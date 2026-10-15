/*
 * @coinsori-strategy v1
 * name: Bollinger Dip Mean Reversion (ETH 1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Mean reversion — the opposite of the trend-chasing
 * champion. When ETH is in a long-term uptrend (close above its 200-day
 * average) and the price stretches far below its 20-day average (below the
 * lower Bollinger band), the drop is usually a dip to be bought, not a new
 * bear market. It makes money in the choppy/range regimes where trend
 * following whipsaws.
 * When it buys and sells: buys when the close is below the lower Bollinger
 * band (20,2) AND RSI(14) < 35 AND the close is above the 200-day average.
 * Sells when the close recovers to the middle band, when RSI(14) climbs above
 * 55, or a 12% hard stop is hit.
 * When it does NOT work: in a real bear market the 200-day filter keeps it in
 * cash mostly, but a sharp dip near the filter can still trigger and the 12%
 * stop takes the hit; in a long grinding decline it stays flat and earns
 * nothing (safe but idle).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 210) return null; // 200-day filter + BB/RSI warmup

  const prevClose = closes[n - 2];
  const sma200 = ctx.sma(200, 1);
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma200 == null || bb == null || bb.lower == null || bb.mid == null || rsi == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.88; // hard stop 12% below entry: a dip that keeps sliding is not a dip
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose >= bb.mid) return { side: 'sell', qty: pos }; // recovered to the mean
    if (rsi > 55) return { side: 'sell', qty: pos }; // momentum returned
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '12% stop' },
               { side: 'sell', price: bb.mid, trigger: 'above', note: 'recovered to mid band',
                 conds: [{ label: 'close vs mid band', ok: prevClose < bb.mid, closed: true },
                         { label: 'RSI(14) close', now: rsi, op: '<=', ref: 55, closed: true }] }]);
    return null;
  }

  // only buy oversold dips inside a long-term uptrend; never catch a falling knife
  const inUptrend = prevClose > sma200;
  const oversold = prevClose < bb.lower && rsi < 35;
  const enter = inUptrend && oversold;
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower dip',
               conds: [{ label: 'close < BB lower', ok: prevClose < bb.lower, closed: true },
                       { label: 'RSI(14) close', now: rsi, op: '<', ref: 35, closed: true },
                       { label: 'close > SMA200', ok: inUptrend, closed: true }] }]);
  if (!enter) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
