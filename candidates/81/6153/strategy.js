/*
 * @coinsori-strategy v1
 * name: BTC Trend Regime Filter 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's worst losses come in sustained downtrends and its biggest
 * gains in long uptrends. A 150-day average separates the two: hold while the close is
 * above it, step aside when the close falls below it, with a hard stop as a backup and a
 * 15% cash buffer so a sudden gap cannot wipe the account.
 * When it buys and sells: Long (85% of cash) when the close is above the 150-day average.
 * Exit to cash when the close falls below the 150-day average or price drops 18% from entry.
 * When it does NOT work: In a wide sideways range it whipsaws around the average and pays
 * fees, and it underperforms holding in a long calm bull market because it is flat during
 * pullbacks that holding absorbs.
 */

function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 160) { ctx.watch([]); return null; }
  const price = ctx.price;
  const pos = ctx.position || 0;

  // account demoted/returning: no new entries, close any open position in an orderly way
  if (ctx.alloc != null && ctx.alloc.status != null && ctx.alloc.status !== 'ok') {
    if (pos > 0) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'Close: account status not ok' }]);
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    ctx.watch([]);
    return null;
  }

  const sma150 = ctx.sma(150, 1);
  if (sma150 == null) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2);
  if (closePrev == null) { ctx.watch([]); return null; }

  if (pos <= 0) {
    ctx.watch([{ side: 'buy', price: sma150, trigger: 'above', note: 'Long: close above 150d avg' }]);
    if (closePrev > sma150) {
      return { side: 'buy', qty: (ctx.cash / price) * 0.85 };
    }
    return null;
  }

  const trendDown = closePrev < sma150;
  const entryPx = ctx.entryPx;
  const stopHit = entryPx != null && price < entryPx * 0.82;

  ctx.watch([
    { side: 'sell', price: sma150, trigger: 'below', note: 'Exit: close below 150d avg' },
    { side: 'sell', price: entryPx != null ? entryPx * 0.82 : price, trigger: 'below', note: 'Hard -18% stop' }
  ]);

  if (trendDown || stopHit) {
    return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
