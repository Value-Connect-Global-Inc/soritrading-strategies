/*
 * @coinsori-strategy v1
 * name: OnChainHashrateTrendOrig
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's mining hashrate is a slow, persistent fundamental —
 * it rises when miners are confident and falls when the network is under stress.
 * Unlike active addresses, it does not wiggle around its average every day, so it
 * is a cleaner long-horizon trend signal.
 * When it buys and sells: buys when hashrate is above its 30-day average (miners
 * expanding) AND price is above its 200-day average (long-term uptrend). Sells on
 * trend break or a hard 3x ATR stop below entry — NOT on every hashrate wiggle.
 * When it does NOT work: hashrate lags price by weeks, so it misses the first leg
 * of a fast recovery; and in a flat market it still pays fees on the SMA200 churn.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const s200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (hr == null || hrSma == null || hrSma <= 0) return null;
  if (s200 == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;
  const minersExpanding = hr > hrSma;
  const inTrend = prevClose > s200;

  if (pos > 0) {
    // Exit only on trend break or hard stop — hashrate wobbles are ignored once in.
    const hardStop = ctx.entryPx - 3 * atr;
    if (price <= hardStop || !inTrend) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '3x ATR stop' }]);
    return null;
  }

  if (inTrend && minersExpanding) {
    // Full cash when the on-chain + trend signal aligns: the hashrate gate already
    // keeps us out of most false signals, so sizing up captures more of the trend.
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 3 * atr, trigger: 'below', note: '3x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'hashrate + trend entry', conds: [
    { label: 'Hashrate > 30d avg', ok: minersExpanding, closed: true },
    { label: 'Close > SMA200', ok: inTrend, closed: true }
  ]}]);
  return null;
}
