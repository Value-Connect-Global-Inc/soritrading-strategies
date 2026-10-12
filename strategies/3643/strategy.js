/*
 * @coinsori-strategy v1
 * name: OnChainHashrateTrend2
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's mining hashrate is a slow, persistent fundamental —
 * it rises when miners are confident and falls when the network is under stress.
 * Its weakness is that it lags price by weeks, so a strict hashrate gate keeps us
 * flat through the start of fast bull runs.
 * When it buys and sells: buys when price is above its 200-day average AND either
 * hashrate is above its 30-day average (miners expanding) OR price is far enough
 * above the 200-day average (10%) that the trend is unambiguous on its own. Sells
 * on trend break or a hard 3x ATR stop below entry.
 * When it does NOT work: in a flat chop around the 200-day average it pays fees on
 * SMA200 churn, and a single fast wick in high-volatility regimes can hit the stop.
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
  // 1.10 = price 10% above the 200d average: the trend is clearly established, so
  // we act on it alone because hashrate lags price by weeks and would keep us out.
  const strongTrend = prevClose > 1.10 * s200;

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

  if (inTrend && (minersExpanding || strongTrend)) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 3 * atr, trigger: 'below', note: '3x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'trend + hashrate entry', conds: [
    { label: 'Close > SMA200', ok: inTrend, closed: true },
    { label: 'Hashrate > 30d avg', ok: minersExpanding, closed: true },
    { label: 'Close > 1.1x SMA200', ok: strongTrend, closed: true }
  ]}]);
  return null;
}
