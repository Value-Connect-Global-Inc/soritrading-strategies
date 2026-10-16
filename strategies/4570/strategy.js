/*
 * @coinsori-strategy v1
 * name: OnChain Hashrate Trend BTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin network hash rate is the computing power miners
 * have committed — it reflects real investment in the network. When hash rate
 * is clearly above its own 30-day average (by 3%), mining is growing and
 * price tends to follow. This is an on-chain axis, different from crowd
 * sentiment.
 * When it buys and sells: buy BTC when hash rate rises 3% above its 30-day
 * average; sell when it falls 3% below, or when price drops 25% below entry
 * (hard stop). The 3% band stops the signal from whipsawing on daily noise.
 * When it does NOT work: hash rate is a slow fundamental — it can keep rising
 * after price has topped, so exits can be late in a crash. In a flat market
 * the signal sits in cash and misses sharp rallies that happen without a
 * mining build-out. The 3% band also delays entries in a fast bull.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // On-chain: hash rate and its precomputed 30-day average.
  const hr = Number(ctx.data('hashrate'));
  const hrAvg = Number(ctx.data('hashrate_sma30'));
  if (!Number.isFinite(hr) || !Number.isFinite(hrAvg) || hrAvg <= 0) return null;

  // Hysteresis: 3% band either side of the average (daily hash rate swings
  // ~20%, so this is a deliberate confirmation rule, not a tight tolerance).
  const enterLvl = hrAvg * 1.03;
  const exitLvl = hrAvg * 0.97;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // Hard stop: caps the loss on any single position at 25%.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    // Mining growth clearly stopped -> the fundamental tailwind is gone.
    if (hr < exitLvl) return { side: 'sell', qty: pos };
    return null;
  }

  // Entry: hash rate clearly above its own average = committed investment.
  if (hr > enterLvl) return { side: 'buy', qty: (ctx.cash / price) * 0.95 };

  return null;
}
