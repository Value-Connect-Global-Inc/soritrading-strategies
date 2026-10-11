/*
 * @coinsori-strategy v1
 * name: BTC Trend-Gated Vol-Target CrashStop 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The trend-gated vol-target crash-stop recipe was validated on
 * SOL (2209) and ETH. Applying it unchanged to BTC is a true out-of-sample test of
 * the family on the most liquid asset. Above the 50-day trend it rides fully
 * invested; between the 50-day trend and an ATR-scaled crash band it sizes down by
 * volatility (2% daily vol target); beyond the crash band it goes to cash.
 * When it buys and sells: above SMA50 = fully invested; below SMA50 but within an
 * ATR-scaled band = vol-target (2% daily); beyond the ATR-scaled crash band =
 * fully to cash. Rebalances toward the target each bar.
 * When it does NOT work: BTC's volatility still means deep drawdowns in violent
 * bull corrections; a fast V-shaped recovery can sell near the bottom and miss the
 * bounce. Adaptive threshold reduces but does not eliminate whipsaw.
 * 2025-04-11 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const sma50 = ctx.sma(50, 1);
  const price = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;
  if (atr == null || sma50 == null || price == null || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const equity = cash + pos * price;
  const trendUp = price > sma50;
  // ATR-scaled crash band: 3.0 ATRs below the SMA50 (same recipe as SOL champion).
  const crashStop = price < sma50 - 3.0 * atr;

  let targetQty;
  if (crashStop) {
    targetQty = 0;
  } else if (trendUp) {
    targetQty = equity / price;
  } else {
    const targetValue = (0.02 * equity) / (atr / price); // 2% daily vol target
    targetQty = targetValue / price;
  }

  const curQty = pos;
  const diff = targetQty - curQty;

  // Display-only watch: what this symbol is waiting for right now.
  const crashLevel = sma50 - 3.0 * atr;
  const watch = [];
  if (pos > 0) {
    watch.push({ side: 'sell', price: crashLevel, trigger: 'below', note: 'crash band full exit' });
    if (trendUp) {
      watch.push({ side: 'sell', price: sma50, trigger: 'below', note: 'trend flip to vol-target' });
    } else {
      watch.push({ side: 'buy', price: sma50, trigger: 'above', note: 'trend re-entry to full' });
    }
  } else {
    watch.push({ side: 'buy', price: crashLevel, trigger: 'above', note: 'crash band entry' });
  }
  ctx.watch(watch);

  if (Math.abs(diff) < 0.0001 * Math.max(0.0001, curQty)) return null;

  if (diff > 0) {
    const buyQty = Math.min(diff, (cash / price) * 0.98);
    if (buyQty <= 0) return null;
    return { side: 'buy', qty: buyQty };
  }
  return { side: 'sell', qty: Math.min(curQty, -diff) };
}
