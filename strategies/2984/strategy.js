/*
 * @coinsori-strategy v1
 * name: BTC 1D Volatility Squeeze Breakout v2
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * 2026-04-27: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: Volatility squeezes (Bollinger bands compressing inside a quiet range)
 * are often followed by an expansion move. This strategy waits for the squeeze and buys the
 * breakout in the direction of the expansion. v2 adds a 200-day trend gate so upside breaks
 * are only taken inside a rising long-term trend — filtering the false breakouts that a
 * quiet bear produces. Uses only price.
 * When it buys and sells: Buy when Bollinger width is in its quietest 20% of the last 100
 * bars AND price closes above the 20-day high AND price is above the rising 200-day average.
 * Sell when price closes back below the 20-day EMA or the 200-day average turns down.
 * When it does NOT work: A squeeze can resolve DOWN, which this long-only version misses. In
 * a long quiet bear the trend gate keeps us flat (capital-preserving but captures little).
 * It lags a relentless melt-up because it only enters after a squeeze, not on every rise.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const bb = ctx.bb(20, 2, 1);
  const ema20 = ctx.ema(20, 1);
  const high20 = ctx.high(20, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (bb == null || bb.upper == null || bb.lower == null || ema20 == null || high20 == null ||
      sma200 == null || sma200prev == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;

  if (pos > 0) {
    // Exit below the 20-day EMA, or if the long-term trend turns down.
    ctx.watch([
      { side: 'sell', price: ema20, trigger: 'below', note: '20 EMA exit' },
      { side: 'sell', conds: [{ label: 'SMA200 trend down', ok: sma200 < sma200prev, closed: true }], note: 'trend down exit' }
    ]);
    if (price < ema20 || sma200 < sma200prev) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Squeeze = band width in the quietest 20% of the last 100 bars.
  const width = (bb.upper - bb.lower) / ((bb.upper + bb.lower) / 2);
  let pctile = 0.5;
  const lookback = 100;
  if (ctx.i >= lookback) {
    let countBelow = 0;
    let total = 0;
    for (let k = 1; k <= lookback; k++) {
      const b = ctx.bb(20, 2, k);
      if (b == null || b.upper == null || b.lower == null) continue;
      const w = (b.upper - b.lower) / ((b.upper + b.lower) / 2);
      total++;
      if (w > width) countBelow++;
    }
    if (total > 0) pctile = countBelow / total;
  }

  // Squeeze + breakout + rising long-term trend (v2 gate: filters bear false breakouts).
  const uptrend = price > sma200 && sma200 > sma200prev;
  ctx.watch([
    {
      side: 'buy',
      price: high20,
      trigger: 'above',
      note: '20-day high breakout',
      conds: [
        { label: 'BB width pctile', now: pctile, op: '<=', ref: 0.2, closed: true },
        { label: 'Width > 0', ok: width > 0, closed: true },
        { label: 'Price > SMA200', now: price, op: '>', ref: sma200, closed: false },
        { label: 'SMA200 rising', ok: sma200 > sma200prev, closed: true }
      ]
    }
  ]);
  if (pctile <= 0.2 && price > high20 && width > 0 && uptrend) {
    const equity = ctx.cash + ctx.uPnl;
    const qty = (Number.isFinite(equity) && equity > 0 ? equity : ctx.cash) / price;
    return { side: 'buy', qty: qty * 0.98 };
  }
  return null;
}
