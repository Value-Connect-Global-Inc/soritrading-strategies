/*
 * @coinsori-strategy v1
 * name: BTC TrendRider VIX Shield 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: All the small-position strategies before it failed because they kept the account
 * only 20-50% invested during BTC's bull runs, so they could never keep up with buy-and-hold. This
 * version goes FULLY invested whenever the long-term trend is up, and treats the trend level itself
 * as the stop (no separate tight stop to churn). A VIX spike above 40 is an escape hatch to cash —
 * it shields the position from the worst crashes without cutting normal pullbacks.
 * When it buys and sells: Buy with ~95% of cash when price is above a rising 200-day average. Sell
 * all when price falls below the 200-day average (trend broken) or when the VIX spikes above 40
 * (market panic — get out, re-enter when it calms and the trend resumes).
 * When it does NOT work: In a long sideways market the 200-day average whipsaws and it alternates
 * between full-in and full-out at bad prices. It lags buy-and-hold in a smooth relentless bull
 * because it exits every pullback below the average. It does not short, so it sits out bears.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const vix = ctx.data('base_vix'); // CBOE VIX, daily, lag 2d
  if (sma200 == null || sma200prev == null) return null;
  const trendUp = sma200 > sma200prev;
  const panic = (vix != null && vix > 40); // VIX>40 = extreme market panic, exit to cash

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken SMA200' },
      { side: 'sell', price: 40, trigger: 'above', note: 'VIX panic exit', conds: [
        { label: 'VIX', now: vix, op: '>', ref: 40, closed: true }
      ]}
    ]);
    if (price < sma200 || panic) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend resume', conds: [
    { label: 'SMA200 rising', ok: trendUp },
    { label: 'VIX calm', ok: !panic }
  ]}]);
  if (trendUp && price > sma200 && !panic) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
