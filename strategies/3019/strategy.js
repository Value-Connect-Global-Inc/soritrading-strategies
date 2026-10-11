/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Accumulation Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's mining hash rate measures the energy and hardware
 * committed to the network. When miners keep adding capacity (hash rate rising), it is
 * a slow, fundamentals-driven bullish backdrop; when hash rate falls, miners are leaving
 * (bearish). This is a DIFFERENT family from the price-based mean-reversion champion —
 * it rides network growth rather than buying dips.
 * When it buys and sells: Buy when hash rate is above its 30-day average (network growing)
 * AND price is above its 200-day average (uptrend). Sell when hash rate falls back below
 * its 30-day average, or price drops below the 50-day average as a safety exit.
 * When it does NOT work: Hash rate is slow-moving, so this lags sharp price reversals and
 * gives back gains in whipsaws. In a bear where miners capitulate late, the exit can lag
 * the top. It is a trend-riding family and will draw down in choppy ranges.
 * 2026-01-16: Display-only ctx.watch added — trading logic unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  if (!Number.isFinite(price) || price <= 0) return null;

  // On-chain hash rate signal from the connected dataset (BTC network mining power).
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);
  if (hr == null || hrSma == null || sma200 == null || sma50 == null) return null;

  // Network growing = hash rate above its own 30-day average.
  const networkGrowing = hr > hrSma;
  const uptrend = price > sma200;

  if (pos > 0) {
    // Exit when miners start leaving (hash rate below its average) or trend breaks.
    if (!networkGrowing || price < sma50) {
      return { side: 'sell', qty: pos };
    }
    // Watch exits: hash rate falling below avg, or price below SMA50.
    ctx.watch([
      { side: 'sell', price: hrSma, trigger: 'below', note: 'hashrate < SMA30', conds: [{ label: 'hashrate', now: hr, op: '>', ref: hrSma, closed: true }] },
      { side: 'sell', price: sma50, trigger: 'below', note: 'price < SMA50', conds: [{ label: 'SMA50', now: sma50, op: '>', ref: price, closed: true }] }
    ]);
    return null;
  }

  if (networkGrowing && uptrend) {
    // Size modestly: this is a slow trend ride, keep risk contained.
    const qty = (ctx.cash / price) * 0.9;
    // Watch entry: hashrate above SMA30 and price above SMA200.
    ctx.watch([
      { side: 'buy', price: hrSma, trigger: 'above', note: 'hashrate > SMA30', conds: [{ label: 'hashrate', now: hr, op: '>', ref: hrSma, closed: true }] },
      { side: 'buy', price: sma200, trigger: 'above', note: 'price > SMA200', conds: [{ label: 'SMA200', now: sma200, op: '<', ref: price, closed: true }] }
    ]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
