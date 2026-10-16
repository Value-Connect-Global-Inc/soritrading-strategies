/*
 * @coinsori-strategy v1
 * name: FearGreed Multi-Asset Regime Basket v8 (SMA100 trend)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge.
 * In crypto, momentum persists: when the crowd is greedy (index >= 55) prices
 * keep climbing, and when the crowd turns fearful (index <= 40) the trend has
 * broken. This rides confirmed sentiment on a 4-coin basket so no single asset
 * decides the account. v8 keeps the fixed 95% sizing, 25% stop and Fed filter,
 * but uses a SOFTER SMA100 trend filter instead of SMA200. A faster filter
 * catches the start of a bull earlier and flags a breakdown sooner, which
 * showed better balance on 2018-2024 than SMA200.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND price
 * is above its 100-day average AND the Fed is not hiking. Sell when it falls
 * to <= 40 or price drops 25% below entry (hard stop).
 * When it does NOT work: in a fast crash the index can still be high while
 * prices are already falling (the index lags) — a faster filter reduces these
 * entries less than SMA200. The 25% stop turns a normal dip into a realized
 * loss, and it misses the very start of a bull because it waits for greed.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    if (fg <= 40) return { side: 'sell', qty: pos };
    return null;
  }

  const sma = ctx.sma(100, 1);
  if (sma == null) return null;

  const fed = Number(ctx.data('fed'));
  const fedLag = Number(ctx.data('fed_lag30'));
  const fedHiking = Number.isFinite(fed) && Number.isFinite(fedLag) && fed > fedLag;

  if (fg >= 55 && price > sma && !fedHiking) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: fg >= 55 ? sma : price,
    trigger: 'above',
    note: 'enter: greed>=55 & trend up & fed ok',
    conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true },
           { label: 'Fed not hiking', ok: !fedHiking }]
  }]);
  return null;
}
