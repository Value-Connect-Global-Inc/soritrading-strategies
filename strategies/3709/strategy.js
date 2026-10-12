/*
 * @coinsori-strategy v1
 * name: HashrateFundamentalsTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin network hashrate is a fundamental signal of miner conviction; price tends to follow network strength with a delay, so rising hashrate supports a long position.
 * When it buys and sells: Buys when price is above its 200-day average AND hashrate is above its 30-day average (network strength rising). Sells when price drops below its 50-day average, hashrate falls below its 30-day average, or a hard 3xATR stop is hit.
 * When it does NOT work: In choppy sideways markets hashrate stays high while price oscillates, causing whipsaw; and around halving dates hashrate resets can give false signals until miners re-commit.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  if (px == null) return null;
  const s200 = ctx.sma(200, 1);
  const s50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (s200 == null || s50 == null || atr == null) return null;

  // On-chain fundamentals: hashrate above its 30d average = network strength rising.
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  if (hr == null || hrAvg == null) return null;
  const hrUp = hr > hrAvg;

  const pos = ctx.position || 0;

  // Hard stop on every position: 3x ATR below entry protects against adverse gaps (1d bars can gap).
  if (pos > 0 && ctx.entryPx != null) {
    const stopPx = ctx.entryPx - 3 * atr;
    if (px < stopPx) return { side: 'sell', qty: pos };
  }

  if (pos > 0) {
    // Exit when the price trend breaks OR network strength fades.
    if (px < s50 || !hrUp) return { side: 'sell', qty: pos };
    ctx.watch([
      { side: 'sell', price: s50, trigger: 'below', note: 'SMA50 break' },
      { side: 'sell', price: ctx.entryPx - 3 * atr, trigger: 'below', note: '3xATR stop' },
      { side: 'sell', price: hrAvg, trigger: 'below', note: 'hashrate fading' }
    ]);
    return null;
  }

  // Entry: long-term price uptrend AND rising network hashrate.
  if (px > s200 && hrUp) {
    const qty = (ctx.cash / px) * 0.99;
    ctx.watch([
      { side: 'sell', price: s50, trigger: 'below', note: 'SMA50 break' },
      { side: 'sell', price: px - 3 * atr, trigger: 'below', note: '3xATR stop' }
    ]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: s200, trigger: 'above', note: 'SMA200 reclaim' }]);
  return null;
}
