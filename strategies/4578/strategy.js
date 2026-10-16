/*
 * @coinsori-strategy v1
 * name: FearGreed Multi-Asset Regime Basket v7c (greed>=65)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge.
 * In crypto, momentum persists: when the crowd is greedy (index >= 55) prices
 * keep climbing, and when the crowd turns fearful (index <= 40) the trend has
 * broken. This rides confirmed sentiment on a 4-coin basket so no single asset
 * decides the account. v7c is the baseline but with a STRICTER entry threshold
 * (F&G >= 65 instead of 55) to test whether stronger greed confirmation cuts
 * false entries in choppy markets.
 * When it buys and sells: on each asset, buy when Fear & Greed >= 65 AND price
 * is above its 200-day average AND the Fed is not hiking. Sell when it falls
 * to <= 40 or price drops 25% below entry (hard stop).
 * When it does NOT work: a stricter threshold means it enters later, missing
 * the early part of a rally, and can still buy into a fast crash while the
 * index is high. The 25% stop turns a normal dip into a realized loss.
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

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const fed = Number(ctx.data('fed'));
  const fedLag = Number(ctx.data('fed_lag30'));
  const fedHiking = Number.isFinite(fed) && Number.isFinite(fedLag) && fed > fedLag;

  if (fg >= 65 && price > sma200 && !fedHiking) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  ctx.watch([{
    side: 'buy',
    price: fg >= 65 ? sma200 : price,
    trigger: 'above',
    note: 'enter: greed>=65 & trend up & fed ok',
    conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 65, closed: true },
           { label: 'Fed not hiking', ok: !fedHiking }]
  }]);
  return null;
}
