/*
 * @coinsori-strategy v1
 * name: BTC 1D USD-Regime Asymmetric Trend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 1000
 *
 * Why this strategy: Bitcoin trades as an anti-dollar risk asset — when the US
 * dollar strengthens, crypto tends to fall; when the dollar weakens, crypto
 * tends to rise. This strategy only holds BTC when the dollar is not
 * unusually strong, and uses the champion's asymmetric trend structure
 * (slow 50-day entry, fast 20-day exit) so it rides uptrends but cuts
 * crashes quickly. The dollar filter is the differentiator: it keeps the
 * account in cash through dollar-driven crypto bears (like 2022).
 * When it buys and sells: buys when the daily close is above its 50-day
 * average AND the dollar is not more than half a standard deviation above
 * its own 60-day mean; sells when the close falls below the 20-day average
 * or the dollar spikes more than one standard deviation above its mean.
 * When it does NOT work: the dollar data arrives with a 10-day delay, so the
 * filter reacts late to a sudden dollar turn; in a crypto bull that happens
 * WHILE the dollar is strong (e.g. late-2020 style), it stays in cash and
 * misses part of the rise; and in sideways chop it flips on and off and pays
 * fees.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const usd = ctx.data("base_usd_broad");
  if (usd == null || price == null) return null;

  // Rolling 60-bar buffer of the dollar index, kept in state so it survives restarts.
  const buf = ctx.state.usdBuf || [];
  buf.push(usd);
  if (buf.length > 60) buf.shift();
  ctx.state.usdBuf = buf;
  if (buf.length < 60) return null; // need a full window before judging the regime

  const mean = buf.reduce((a, b) => a + b, 0) / buf.length;
  const variance = buf.reduce((a, b) => a + (b - mean) * (b - mean), 0) / buf.length;
  const std = Math.sqrt(variance);
  const usdZ = std > 0 ? (usd - mean) / std : 0;

  const sma50_1 = ctx.sma(50, 1);
  const sma20_1 = ctx.sma(20, 1);
  if (sma50_1 == null || sma20_1 == null) return null;
  const close1 = ctx.closes.at(-2);
  if (close1 == null) return null;

  if (ctx.position > 0) {
    // Exit: fast 20d trend break, or a dollar strength spike (risk-off).
    ctx.watch([{ side: 'sell', price: sma20_1, trigger: 'below', note: 'fast exit: below 20d MA',
                 conds: [{ label: 'USD z > 1.0 (risk-off)', now: usdZ, op: '>', ref: 1.0, closed: true }] }]);
    if (close1 < sma20_1 || usdZ > 1.0) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  // Entry: slow 50d trend up AND dollar not unusually strong (risk-on).
  const trendUp = close1 > sma50_1;
  const riskOn = usdZ < 0.5;
  ctx.watch([{ side: 'buy', price: sma50_1, trigger: 'above', note: 'slow entry: above 50d MA',
               conds: [{ label: 'USD z < 0.5 (risk-on)', now: usdZ, op: '<', ref: 0.5, closed: true }] }]);
  if (trendUp && riskOn) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
