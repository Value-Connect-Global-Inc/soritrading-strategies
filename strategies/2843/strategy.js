/*
 * @coinsori-strategy v1
 * name: Hashrate Regime Gate BTC 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin mining hashrate is slow-moving and smooth —
 * it reflects the long-run health and security of the network. When
 * hashrate is in an uptrend, miners are confident and the network is
 * growing; that is a favorable regime for price. This uses hashrate as a
 * SLOW regime gate (not a noisy per-bar trigger), then confirms with price
 * trend before going long.
 * When it buys and sells: goes long only when BOTH hashrate is trending up
 * (above its 30-day average) AND price is above its 50-day average. Sells
 * when either condition breaks.
 * When it does NOT work: hashrate is a lagging, low-frequency signal, so it
 * is late into new uptrends and slow to exit — it can give back gains in
 * sharp reversals and misses fast initial rallies. In a flat market it may
 * churn between the two conditions.
 *
 * 2024-01-01: display-only change — added ctx.watch declarations; trading logic unchanged.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Slow regime gate: hashrate vs its 30-day average (smooth, precomputed).
  const hr = Number(ctx.data('hashrate'));
  const hrSma = Number(ctx.data('hashrate_sma30'));
  if (!Number.isFinite(hr) || !Number.isFinite(hrSma) || hr <= 0 || hrSma <= 0) return null;

  // Price trend confirmation: price above its 50-day SMA.
  const sma50 = ctx.sma(50, 1);
  if (sma50 == null) return null;

  const hashUp = hr > hrSma * 1.01; // 1% hysteresis so we don't flip on noise
  const priceUp = price > sma50;

  // --- Exit: either regime or trend breaks ---
  if (pos > 0) {
    if (!hashUp || !priceUp) {
      ctx.watch([{ side: 'sell', price: price, trigger: 'below', note: 'regime/treak break', conds: [
        { label: 'hashrate > SMA30', ok: hashUp },
        { label: 'price > SMA50', ok: priceUp }
      ]}]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 break' },
               { side: 'sell', price: hrSma * 1.01, trigger: 'below', note: 'hashrate SMA30 break' }]);
    return null;
  }

  // --- Entry: both conditions must hold ---
  if (hashUp && priceUp) {
    ctx.watch([{ side: 'buy', price: sma50, trigger: 'above', note: 'SMA50 hold', conds: [
      { label: 'hashrate > SMA30', ok: hashUp }
    ]}]);
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }

  // No position, not entering — watch for entry conditions
  const watchEntries = [];
  if (!hashUp) {
    watchEntries.push({ side: 'buy', price: hrSma * 1.01, trigger: 'above', note: 'hashrate SMA30', conds: [
      { label: 'price > SMA50', ok: priceUp }
    ]});
  }
  if (!priceUp) {
    watchEntries.push({ side: 'buy', price: sma50, trigger: 'above', note: 'SMA50', conds: [
      { label: 'hashrate > SMA30', ok: hashUp }
    ]});
  }
  ctx.watch(watchEntries);
  return null;
}
