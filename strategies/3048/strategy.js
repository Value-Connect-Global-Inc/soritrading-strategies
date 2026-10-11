/*
 * @coinsori-strategy v1
 * name: BTC 1D Squeeze-Breakout Trend-Gated
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 * 2025-04-11 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: Big BTC moves often start from a quiet squeeze — Bollinger
 * bands compress (low volatility) and then price breaks out of the compression.
 * Buying the breakout out of a quiet squeeze rides the volatility expansion that
 * follows. A rising 200-day average gate keeps us in established uptrends and
 * steps aside in bear markets, giving a defensive profile that protects capital
 * while still catching trend expansions.
 * When it buys and sells: Buy when price breaks above the 20-day high AND the
 * Bollinger band width is in its quietest 20% of the last 100 bars (a squeeze),
 * AND the 200-day average is rising. Sell when price closes below the 20-day EMA.
 * When it does NOT work: In a sideways market the squeeze-breakout whipsaws and
 * churns. It lags straight-line melt-ups because it waits for a squeeze to
 * resolve, and the 200-day gate sits out early bear recoveries.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const bb = ctx.bb(20, 2, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  if (bb == null || bb.upper == null || bb.lower == null || bb.mid == null) return null;
  if (sma200 == null || sma200prev == null || ema20 == null) return null;

  const width = bb.upper - bb.lower;
  if (!Number.isFinite(width) || width <= 0) return null;

  const trendOk = sma200 > sma200prev;   // 200-day average rising = uptrend regime

  // Squeeze: current Bollinger width in the quietest 20% of the last 100 bars.
  const closes = ctx.closes;
  let quietest = false;
  if (closes && closes.length >= 101) {
    let count = 0;
    for (let k = closes.length - 100; k < closes.length; k++) {
      const b = ctx.bb(20, 2, closes.length - 1 - k);
      if (b == null || b.upper == null || b.lower == null) continue;
      const w = b.upper - b.lower;
      if (Number.isFinite(w) && w > width) count++;
    }
    // width is smaller than ~80% of the last 100 widths → in the quietest 20%.
    quietest = count >= 80;
  }

  const high20 = ctx.high(20, 1);

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'below', note: '20d EMA exit' }]);
    // Exit when price closes below the 20-day EMA (trend lost).
    if (price < ema20) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (high20 != null) {
    ctx.watch([{ side: 'buy', price: high20, trigger: 'above', note: '20d high breakout',
      conds: [
        { label: '200d avg rising', ok: trendOk },
        { label: 'squeeze quietest 20%', ok: quietest }
      ] }]);
  } else {
    ctx.watch([]);
  }

  // Entry: breakout above 20-day high out of a squeeze, in a rising 200-day trend.
  if (trendOk && quietest && high20 != null && price > high20) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
