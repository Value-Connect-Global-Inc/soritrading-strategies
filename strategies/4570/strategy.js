/*
 * @coinsori-strategy v1
 * name: OnChain Hashrate Trend BTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin network hash rate is the computing power miners
 * have committed — slow-moving, smooth, and it reflects real investment in the
 * network. When hash rate is above its own 30-day average, mining is growing
 * (long-term confidence); price tends to follow. This is an on-chain axis,
 * different from crowd sentiment.
 * When it buys and sells: buy BTC when hash rate rises above its 30-day
 * average; sell when it falls back below, or when price drops 25% below entry
 * (hard stop).
 * When it does NOT work: hash rate is a slow fundamental — it can keep rising
 * after price has topped, so exits can be late in a crash. In a flat market
 * the signal sits in cash and misses sharp rallies that happen without a
 * mining build-out.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // On-chain: hash rate and its precomputed 30-day average.
  const hr = Number(ctx.data('hashrate'));
  const hrAvg = Number(ctx.data('hashrate_sma30'));
  if (!Number.isFinite(hr) || !Number.isFinite(hrAvg) || hrAvg <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // Hard stop: caps the loss on any single position at 25%.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Mining growth stopped -> the fundamental tailwind is gone.
    if (hr < hrAvg) return { side: 'sell', qty: pos };
    return null;
  }

  // Entry: hash rate above its own average = committed network investment.
  if (hr > hrAvg) return { side: 'buy', qty: (ctx.cash / price) * 0.95 };

  return null;
}
