/*
 * @coinsori-strategy v1
 * name: BTC Dollar-Weakness Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The US dollar index is a slow macro driver of risk assets.
 * A weakening dollar (falling below its own 90-day mean) historically supports
 * crypto; a strengthening dollar pressures it. This is a different data axis
 * (macro FX) from price alone.
 * When it buys and sells: Buy BTC when the dollar is below its own 90-day mean
 * (dollar weakening) AND BTC price is above its 50-day average (uptrend started).
 * Sell when BTC breaks below its 50-day average or the dollar strengthens sharply
 * (more than 0.5 standard deviations above its own 90-day mean).
 * When it does NOT work: In periods where crypto and the dollar move together
 * (e.g. 2020 liquidity-driven rally), the dollar filter can keep it out of good
 * trades. The dollar data is slow (10-day lag), so it lags fast regime changes.
 */
function onUpdate(ctx) {
  const dxy = ctx.data("base_usd_broad");
  const sma50 = ctx.sma(50, 1);
  if (dxy == null || sma50 == null) return null;
  const close = ctx.closes.at(-2);
  if (close == null) return null;

  // Accumulate dollar history in restart-surviving state to compute its own
  // 90-day mean and stdev (dollar z-score), so we compare the dollar to itself
  // rather than a fixed level.
  const hist = ctx.state.dxyHist || [];
  hist.push(dxy);
  if (hist.length > 120) hist.shift();
  ctx.state.dxyHist = hist;
  if (hist.length < 90) return null; // need 90 days of dollar history
  const window = hist.slice(-90);
  const mean = window.reduce((a, b) => a + b, 0) / window.length;
  const variance = window.reduce((a, b) => a + (b - mean) * (b - mean), 0) / window.length;
  const sd = Math.sqrt(variance) || 1;
  const z = (dxy - mean) / sd; // dollar z-score: >0 = dollar strong, <0 = weak

  if (ctx.position <= 0) {
    if (z < 0 && close > sma50) {
      ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'SMA50 uptrend',
        conds: [{ label: 'dollar z', now: z, op: '<', ref: 0, closed: true }] }]);
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
    }
    ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'SMA50 uptrend',
      conds: [{ label: 'dollar z', now: z, op: '<', ref: 0, closed: true }] }]);
    return null;
  }

  if (close < sma50 || z > 0.5) {
    ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 break',
      conds: [{ label: 'dollar z', now: z, op: '>', ref: 0.5, closed: true }] }]);
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 break',
    conds: [{ label: 'dollar z', now: z, op: '>', ref: 0.5, closed: true }] }]);
  return null;
}
