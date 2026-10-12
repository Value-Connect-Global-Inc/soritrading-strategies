/*
 * @coinsori-strategy v1
 * name: BTC 1D OBV Flow Trend Fast
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: On BTC's daily chart, money flowing in (rising OBV) while
 * price holds above its medium-term average marks a real uptrend. This version
 * uses a SHORTER OBV lookback and a 50-day average instead of 200, so it enters
 * earlier in a rally than the slow version and captures more of the move.
 * When it buys and sells: it buys when OBV has risen over the last 14 days AND
 * price is above the 50-day average. It sells when OBV has fallen over the last
 * 14 days OR price drops below the 50-day average.
 * When it does NOT work: in a choppy sideways market the 14-day OBV slope flips
 * often and whipsaws. In a slow grinding bull it exits early on small pullbacks.
 * It is a long-only trend follower, so it sits in cash during bear markets.
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  const volumes = ctx.volumes;
  const i = ctx.i;
  if (!closes || !volumes) return null;
  const look = 14;
  if (closes.length < 60 || volumes.length < 60 || i < 60) return null;

  // compute OBV up to the last CLOSED bar (ago=1) so live/backtest match
  const end = closes.length - 2; // last closed bar index
  if (end < 0) return null;
  let obv = 0;
  for (let k = 1; k <= end; k++) {
    if (closes[k] > closes[k - 1]) obv += volumes[k];
    else if (closes[k] < closes[k - 1]) obv -= volumes[k];
  }
  // OBV at (end - look) bars ago
  let obvPrev = 0;
  const start = Math.max(1, end - look);
  for (let k = 1; k <= start; k++) {
    if (closes[k] > closes[k - 1]) obvPrev += volumes[k];
    else if (closes[k] < closes[k - 1]) obvPrev -= volumes[k];
  }

  const sma50 = ctx.sma(50, 1);
  const px = closes[end];
  if (sma50 == null || px == null) return null;

  if (ctx.position > 0) {
    ctx.watch([
      { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 break' },
      { side: 'sell', note: 'OBV rollover', conds: [{ label: 'OBV 14D falling', ok: obv < obvPrev, closed: true }] }
    ]);
    // exit on OBV rollover or price breaking the 50-day average
    if (obv < obvPrev || px < sma50) return { side: 'sell', qty: ctx.position };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma50, trigger: 'above', note: 'SMA50 reclaim', conds: [{ label: 'OBV 14D rising', ok: obv > obvPrev, closed: true }] }
  ]);

  // enter on rising OBV flow while above the 50-day trend line
  if (obv > obvPrev && px > sma50) {
    const qty = (ctx.cash / ctx.price) * 0.95;
    if (qty > 0) return { side: 'buy', qty: qty };
  }
  return null;
}
