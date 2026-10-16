/*
 * @coinsori-strategy v1
 * name: FearGreed Multi-Asset Regime Basket v5b (7d cooldown)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge.
 * In crypto, momentum persists: when the crowd is greedy (index >= 55) prices
 * keep climbing, and when the crowd turns fearful (index <= 40) the trend has
 * broken. This rides confirmed sentiment on a 4-coin basket so no single asset
 * decides the account. v3 added a Fed filter (no entries while the Fed hikes).
 * v5b uses a SHORTER 7-day re-entry cooldown after a stop-loss exit, to test
 * whether 14 days was too slow to re-enter a quick recovery.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND price
 * is above its 200-day average AND the Fed is not hiking AND no stop-loss exit
 * happened in the last 7 days. Sell when it falls to <= 40 or price drops 25%
 * below entry (hard stop).
 * When it does NOT work: in a fast crash the index can still be high while
 * prices are already falling (the index lags) — the 200-day filter reduces
 * these entries but cannot remove all of them. The 25% stop turns a normal
 * dip into a realized loss, and it misses the very start of a bull because it
 * waits for confirmed greed.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  const st = ctx.state;
  const sym = ctx.sym;
  if (st[sym] == null) st[sym] = {};

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      if (price <= entry * 0.75) {
        st[sym].stopOutAt = ctx.i;
        return { side: 'sell', qty: pos };
      }
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    if (fg <= 40) return { side: 'sell', qty: pos };
    return null;
  }

  // 7-day re-entry cooldown after a stop-loss exit.
  if (st[sym].stopOutAt != null) {
    if (ctx.i - st[sym].stopOutAt < 7) {
      ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'cooldown: stopped out <7d ago' }]);
      return null;
    }
    delete st[sym].stopOutAt;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const fed = Number(ctx.data('fed'));
  const fedLag = Number(ctx.data('fed_lag30'));
  const fedHiking = Number.isFinite(fed) && Number.isFinite(fedLag) && fed > fedLag;

  if (fg >= 55 && price > sma200 && !fedHiking) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: fg >= 55 ? sma200 : price,
    trigger: 'above',
    note: 'enter: greed>=55 & trend up & fed ok',
    conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true },
           { label: 'Fed not hiking', ok: !fedHiking }]
  }]);
  return null;
}
