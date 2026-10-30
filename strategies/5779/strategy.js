/*
 * @coinsori-strategy v1
 * name: BTC SlowEntry FastExit 1D
 * interval: 1d
 * ex: binance
 * syms: BTC/USDT
 * cash: 10000
 *
 * Why this strategy: Long-only strategies lost to buy-and-hold in bulls and to the 2022 bear because
 * their exits were too slow — they rode the -75% crash down before leaving. This version uses an
 * ASYMMETRIC trend: a slow 200-day confirmation to enter (avoid false breakouts), but a fast 50-day
 * exit to leave BEFORE a real crash gets deep. Fully invested in uptrends, quickly out in downtrends.
 * When it buys and sells: Buy with ~95% of cash when the 200-day average is rising and price is above
 * it (confirmed uptrend). Sell all when price falls below the 50-day average (fast trend break) or on
 * a 20% hard stop as a final safety net. Re-enter only after the 200-day trend resumes.
 * When it does NOT work: In a sideways market the fast exit whipsaws (each exit is a small loss).
 * It lags buy-and-hold in a smooth relentless bull because it exits pullbacks. It does not short.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const sma50 = ctx.sma(50, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma50 == null || sma200 == null || sma200prev == null) return null;
  const trendUp = sma200 > sma200prev;

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.80 : null; // 20% hard stop, final safety net only
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'fast exit SMA50' },
      { side: 'sell', price: stop, trigger: 'below', note: '20% stop' }
    ]);
    if (price < sma50) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (stop != null && price < stop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend confirmed', conds: [
    { label: 'SMA200 rising', ok: trendUp }
  ]}]);
  if (trendUp && price > sma200) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
