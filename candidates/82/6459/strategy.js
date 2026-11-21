/*
 * @coinsori-strategy v1
 * name: BTC Fear&Greed Contrarian 1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Extreme crowd sentiment (Crypto Fear & Greed index) is a
 * contrarian signal — extreme fear marks bottoms, extreme greed marks tops.
 * When it buys and sells: buys when the index is deeply oversold (fear) and the
 * price is not in a strong downtrend, sells when it reaches extreme greed or a
 * hard stop is hit.
 * When it does NOT work: in a persistent bear market the index can stay in fear
 * while price keeps falling, so the contrarian buy keeps losing; the hard stop
 * limits this but the strategy underperforms holding during strong bull runs.
 */
function onUpdate(ctx) {
  // Read the Fear & Greed index (daily). Null = data not connected or unknown.
  const fg = ctx.data('fear_greed');
  if (fg == null) {
    ctx.watch([]);
    return null;
  }

  // Only act on the last closed daily bar for consistency.
  const close = ctx.closes.at(-2);
  if (close == null) return null;
  const price = ctx.price;

  // Regime filter: only buy when price is above its 200-day SMA (not a strong bear).
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);

  const inPosition = ctx.position > 0;

  // ---- Exit logic first ----
  if (inPosition) {
    // Hard stop loss: 25% below entry to cap downside in any regime.
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    // Take profit on extreme greed (index >= 80): crowd euphoria = sell.
    const takeProfit = fg >= 80;

    const watches = [];
    if (stop != null) {
      watches.push({ side: 'sell', price: stop, trigger: 'below', note: 'hard stop -25%' });
    }
    watches.push({ side: 'sell', price: close, trigger: 'above', note: 'FG>=80 take profit', conds: [{ label: 'FG index', now: fg, op: '>=', ref: 80 }] });
    ctx.watch(watches);

    if (takeProfit) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    if (stop != null && price <= stop) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }

  // ---- Entry logic ----
  // Buy when index is deeply fearful (<= 20) and price is above the 200-day SMA.
  if (sma200 == null || sma200 === 0) {
    ctx.watch([]);
    return null;
  }
  const deepFear = fg <= 20;
  const aboveSma200 = close > sma200;
  const trendOk = sma50 != null && sma50 > sma200;

  ctx.watch([{
    side: 'buy',
    price: sma200,
    trigger: 'above',
    note: 'buy on deep fear + uptrend',
    conds: [
      { label: 'FG index', now: fg, op: '<=', ref: 20 },
      { label: 'SMA50 > SMA200', ok: trendOk }
    ]
  }]);

  if (deepFear && aboveSma200 && trendOk) {
    const qty = (ctx.cash / price) * 0.95;
    return { side: 'buy', qty: qty };
  }

  return null;
}
