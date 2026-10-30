/*
 * @coinsori-strategy v1
 * name: BTC VolTarget Trend Trail 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Every prior long-only strategy here lost to stop-churn — buying with 90% of cash
 * and a fixed 12% stop means each stop costs ~10% of the account, repeated dozens of times in chop.
 * This version changes the STRUCTURE: it risks only a small fixed fraction of equity per trade
 * (sized by volatility), so no single loss can hurt the account, and it trails winners instead of
 * cutting them at a fixed percentage. Trend-following lets the few big wins pay for the many small
 * losses — the classic way to survive any regime.
 * When it buys and sells: Buy when price is above a rising 200-bar average (uptrend). Position size is
 * set so a 3×ATR stop costs about 1.5% of equity. Sell when price falls below the 200-bar average
 * (trend broken) or when price drops 3×ATR below the highest point since entry (trailing stop).
 * When it does NOT work: In a long sideways chop the trend gate produces false entries that each lose
 * the small risk amount — many losses but each small. It lags buy-and-hold in a relentless straight
 * bull because it exits on pullbacks and re-enters higher. It does not short, so it sits out bears
 * instead of profiting from them.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || sma200prev == null || atr == null) return null;
  const trendUp = sma200 > sma200prev;

  if (pos > 0) {
    const peak = (ctx.state.peak != null && ctx.state.peak > price) ? ctx.state.peak : price;
    ctx.state.peak = peak;
    const trail = peak - 3 * atr; // trailing stop: 3×ATR below the highest close since entry
    const stopPx = Math.max(trail, ctx.state.stopPx != null ? ctx.state.stopPx : 0);
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken SMA200' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'trailing 3×ATR stop' }
    ]);
    if (price < sma200 || price < stopPx) {
      ctx.state.peak = null;
      ctx.state.stopPx = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.state.peak = null;
  ctx.state.stopPx = null;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend entry', conds: [
    { label: 'SMA200 rising', ok: trendUp }
  ]}]);
  if (trendUp && price > sma200) {
    const riskPct = 0.015; // 1.5% of equity risked per trade — small enough to survive repeated stops
    const stopDist = 3 * atr; // stop distance in price units
    const riskCash = ctx.cash * riskPct;
    let qty = riskCash / stopDist;
    const maxQty = ctx.cash / price * 0.98; // never trade on margin
    if (qty > maxQty) qty = maxQty;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.state.stopPx = price - stopDist;
    return { side: 'buy', qty: qty };
  }
  return null;
}
