/*
 * @coinsori-strategy v1
 * name: FearGreed Multi-Asset Regime Basket v6 (trailing stop)
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
 * v6 replaces the fixed 25% stop with a TRAILING stop (20% off the highest
 * close since entry): a slow decline now locks in gains instead of giving them
 * all back, and a normal dip no longer triggers a needless stop-out.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND price
 * is above its 200-day average AND the Fed is not hiking. Sell when it falls
 * to <= 40, or when price drops 20% below the highest close since entry.
 * When it does NOT work: in a fast crash the index can still be high while
 * prices are already falling (the index lags) — the 200-day filter reduces
 * these entries but cannot remove all of them. The trailing stop still turns a
 * sharp reversal into a realized loss (it is a stop, not a guarantee), and it
 * misses the very start of a bull because it waits for confirmed greed.
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
    // Track the highest close since entry for the trailing stop.
    if (st[sym].peak == null || price > st[sym].peak) st[sym].peak = price;
    const stop = st[sym].peak * 0.80; // trailing stop 20% below the peak
    if (price <= stop) {
      delete st[sym].peak;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop: -20% from peak' }]);
    if (fg <= 40) return { side: 'sell', qty: pos }; // greed over -> exit
    return null;
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
