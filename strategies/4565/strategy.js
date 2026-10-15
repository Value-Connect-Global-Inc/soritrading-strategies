/*
 * @coinsori-strategy v1
 * name: FedRate Macro Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin trades as a risk asset whose liquidity is set by
 * the Fed. When the Fed is cutting rates or they are near zero, money flows
 * into crypto; when the Fed is hiking from an elevated level, liquidity drains
 * and BTC tends to fall. The fed funds rate is slow and smooth — unlike on-chain
 * noise — so it should produce few, clean regime switches.
 * When it buys and sells: buys BTC when the fed funds rate is falling or below
 * 2.5% (easy money) AND price is above its 200-day SMA (no falling knives);
 * sells when the rate is rising from an elevated level (tight money) or a
 * 2xATR stop is hit.
 * When it does NOT work: BTC can rally even while the Fed holds rates high
 * (e.g. the ETF-driven 2023-24 bull) — this misses those moves. It can also
 * stay flat for years during a high-rate plateau.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fed = ctx.data('fed');         // effective fed funds rate, percent
  const fedPrev = ctx.data('fed_lag30'); // same series 30 days ago (precomputed)
  if (fed == null || fedPrev == null) return null; // data not connected -> stay flat

  const pos = ctx.position;

  // Easy money = rate falling, OR rate below 2.5% (negligible hurdle).
  // Tight = rate rising AND already above 2.5% (real tightening, not noise).
  const easy = fed < fedPrev || fed < 2.5;
  const tight = fed > fedPrev && fed >= 2.5;

  if (pos > 0) {
    const entry = ctx.entryPx;
    const atr = ctx.atr(14, 1);
    if (entry != null && atr != null) {
      const stopPx = entry - 2 * atr; // hard stop: caps single-position loss
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: 2xATR' }]);
    }
    if (tight) return { side: 'sell', qty: pos }; // regime flipped -> get out
    return null;
  }

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  if (easy && price > sma200) {
    ctx.watch([{ side: 'buy', price: price, trigger: 'above', note: 'enter: easy money' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
