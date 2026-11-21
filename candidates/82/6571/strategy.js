/*
 * @coinsori-strategy v1
 * name: ETH Fear-Greed Regime Trend 4H v2
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto-native sentiment (the Fear & Greed index) measures whether traders are
 * euphoric or panicked. Euphoria marks late-stage tops; extreme fear marks crisis bottoms. This rides
 * ETH's trend but refuses to buy into euphoria and steps out when sentiment collapses. It uses the
 * same 2-day streak smoothing on the panic exit as the sibling VIX strategy, so a single daily fear
 * blip does not churn the position.
 * When it buys and sells: Buy ETH with the whole account when the last closed 4h close is above a
 * RISING 200-bar SMA AND Fear & Greed is below 78 (not euphoric). Sell everything when the close falls
 * below the SMA, or when Fear & Greed stays below 25 for two consecutive daily readings. A 3x ATR stop
 * closes any position that drops that far from entry.
 * When it does NOT work: Fear & Greed is daily and lags, so a fast crypto-only move the index has not
 * caught up with is missed. In a long flat range the price crosses the SMA and each crossing costs
 * fees. Long-only: it misses short-side profit in bear markets. Extreme-greed exits can sell too early
 * in a blow-off rally that keeps climbing.
 */
function onUpdate(ctx) {
  const sma = ctx.sma(200, 1);
  if (sma == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // Fear & Greed regime filter (daily, 0-100). Below 78 = not euphoric (safe to buy),
  // below 25 = extreme fear (crisis). The panic exit needs 2 consecutive daily readings
  // below 25 so a single fear blip does not churn the position (same as the VIX sibling).
  const fg = ctx.data('fear_greed');
  const notEuphoric = fg == null ? true : fg < 78;
  const st = ctx.state;
  const fearStreak = fg != null && fg < 25 ? (st.fearStreak || 0) + 1 : 0;
  st.fearStreak = fearStreak;
  const extremeFear = fearStreak >= 2;

  const band = 0.02; // 2% hysteresis so small noise around the SMA does not churn the position
  const pos = ctx.position || 0;

  // volatility hard stop: 3x the 14-bar ATR from entry
  if (pos > 0 && ctx.entryPx != null) {
    const atr = ctx.atr(14, 1);
    if (atr != null) {
      const stop = ctx.entryPx - 3 * atr;
      if (prevClose < stop) {
        ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'ATR hard stop' }]);
        return { side: 'sell', qty: pos, reduceOnly: true };
      }
    }
  }

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma * (1 - band), trigger: 'below', note: 'SMA200 -2% exit' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'extreme fear exit', conds: [{ label: 'F&G <25 2d', ok: extremeFear }] }
    ]);
    if (prevClose < sma * (1 - band) || extremeFear) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const smaPrev = ctx.sma(200, 5);
  if (smaPrev == null) return null;
  const rising = sma > smaPrev;

  ctx.watch([{ side: 'buy', price: sma * (1 + band), trigger: 'above', note: 'SMA200 +2% go long', conds: [{ label: 'not euphoric', ok: notEuphoric }] }]);
  if (rising && notEuphoric && prevClose > sma * (1 + band)) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
