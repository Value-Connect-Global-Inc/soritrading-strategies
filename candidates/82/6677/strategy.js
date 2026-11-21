/*
 * @coinsori-strategy v1
 * name: Volatility Pullback Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In an uptrend, prices pull back to their short-term mean
 * before continuing. Buying a deep pullback (price 1.5 standard deviations below
 * its 20-bar average) and selling the bounce back to the mean captures that
 * reversion. The 200-bar trend filter keeps us out of falling markets where
 * pullbacks just keep going down.
 * When it buys and sells: buys when the last closed 4h bar is 1.5 sigma below its
 * 20-bar mean while the close is above its 200-bar average; sells when the price
 * recovers to 0.5 sigma above the mean, or a 6% hard stop is hit.
 * When it does NOT work: in a strong bear market the trend filter keeps it in cash
 * (no loss, but misses the short-side); in a tight choppy range it can buy
 * pullbacks that do not bounce and hit the stop repeatedly.
 */
function onUpdate(ctx) {
  const Z_ENTER = -1.5;   // deep pullback: 1.5 SD below the 20-bar mean
  const Z_EXIT = 0.5;     // reversion target: 0.5 SD above the mean
  const STOP = 0.06;      // hard stop 6% below entry (4h swing, keeps losses small)
  const TREND_N = 200;    // regime filter: 200 x 4h = ~33 days, only buy in uptrend
  const SIZE = 0.5;       // half the cash per trade so one stop costs ~3% of account

  const mean = ctx.sma(20, 1);
  const sd = ctx.stdev(20, 1);
  const trend = ctx.sma(TREND_N, 1);
  const prevClose = ctx.closes.at(-2);
  if (mean == null || sd == null || trend == null || prevClose == null) { ctx.watch([]); return null; }
  if (sd <= 0) { ctx.watch([]); return null; }

  const z = (prevClose - mean) / sd;
  const holding = ctx.position > 1e-9;
  const uptrend = prevClose > trend;
  const entryLevel = mean - Z_ENTER * sd;  // the price at which z hits -1.5
  const targetLevel = mean + Z_EXIT * sd;  // the price at which z hits +0.5

  // rule 6: declare every entry/exit price every tick
  if (holding) {
    const w = [{ side: 'sell', price: targetLevel, trigger: 'above', note: 'reversion target' }];
    if (ctx.entryPx != null) {
      w.push({ side: 'sell', price: ctx.entryPx * (1 - STOP), trigger: 'below', note: 'hard stop' });
    }
    ctx.watch(w);
  } else {
    ctx.watch([{ side: 'buy', price: entryLevel, trigger: 'below', note: 'pullback z<=-1.5', conds: [{ label: 'uptrend', ok: uptrend }] }]);
  }

  // exits (reduce-only, sized from ctx.position)
  if (holding) {
    if (prevClose >= targetLevel) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (ctx.entryPx != null && ctx.price <= ctx.entryPx * (1 - STOP)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // entry: deep pullback, but only inside a confirmed uptrend
  if (uptrend && z <= Z_ENTER) {
    return { side: 'buy', qty: ctx.cash / ctx.price * SIZE };
  }
  return null;
}
