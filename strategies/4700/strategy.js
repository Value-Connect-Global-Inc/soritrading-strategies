/*
 * @coinsori-strategy v1
 * name: BTC RSI2 Dip Mean Reversion 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: In a healthy long-term uptrend, short sharp pullbacks (2-period RSI collapsing
 * below 10) have historically been followed by a bounce back toward the trend. This buys those
 * panic dips instead of chasing breakouts, so it is a mean-reversion family distinct from the
 * volatility-timing (BB squeeze) strategy.
 * When it buys and sells: buys when a closed daily bar has RSI(2) < 10 AND price is above a RISING
 * 200-day SMA (uptrend intact, not a bear-market falling knife). Sells on a 2.5x ATR stop, when a
 * closed bar closes below the 200-day SMA (trend broken), or when RSI(2) closes above 70 (bounce done).
 * When it does NOT work: in a bear market price stays below the 200-SMA so it never buys (safe but
 * misses the bottom). In a slow grinding uptrend RSI(2) rarely drops below 10, so it sits out most
 * of the rally. Sharp single-day crashes inside the uptrend can hit the ATR stop before the bounce.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 210) return null; // need SMA200 + RSI warmup

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 2);
  if (sma200 == null || sma200Prev == null) return null;

  const rsi2 = ctx.rsi(2, 1); // last CLOSED bar
  if (rsi2 == null) return null;

  const NB = c.length - 2;
  const pos = ctx.position;

  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (c[NB] < sma200) return { side: 'sell', qty: pos };
    if (rsi2 > 70) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'trend break' },
               { side: 'sell', price: 70, trigger: 'above', note: 'RSI(2) overbought' }]);
    return null;
  }

  const uptrend = sma200 > sma200Prev; // rising long-term trend
  const oversold = rsi2 < 10; // extreme short-term panic
  const aboveTrend = c[NB] > sma200;

  if (!(uptrend && oversold && aboveTrend)) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'buy panic dip in uptrend',
                 conds: [{ label: 'RSI(2) close', now: rsi2, op: '<', ref: 10, closed: true },
                         { label: 'SMA200 rising', ok: uptrend, closed: true },
                         { label: 'above SMA200', ok: aboveTrend, closed: true }] }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 2% of price per ATR)
  const atrPct = atr / c[NB];
  const volScale = Math.min(1, 0.02 / atrPct);
  const qty = (ctx.cash * 0.95 * volScale) / price * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'RSI(2) dip in uptrend' }]);
  return { side: 'buy', qty };
}
