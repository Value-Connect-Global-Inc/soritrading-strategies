/*
 * @coinsori-strategy v1
 * name: Trend-Gated Vol-Target CrashStop LINK 1D
 * ex: binance
 * syms: LINKUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A volatility-targeting family (distinct from the OBV trend
 * and Keltner mean-reversion champions). It stays fully invested while the trend
 * is up, scales to a fixed daily-volatility target in a mild downtrend, and
 * exits fully to cash on a genuine crash. This continuously de-risks in choppy
 * or falling markets while participating in uptrends — a defensive signature
 * that was validated on BTC/ETH/SOL/XRP/BNB 1d. This tests whether it
 * generalizes to a fresh asset (LINK).
 * When it buys and sells: above the 50-day average = fully invested; below it
 * but within an ATR-scaled band = size to a 2% daily vol target; beyond 3.0
 * ATRs below the average = fully to cash (crash stop).
 * When it does NOT work: in a violent V-shaped recovery it can sell near the
 * bottom and miss the bounce; LINK's higher volatility means deeper drawdowns
 * in sharp bull corrections than the majors.
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const sma50 = ctx.sma(50, 1);
  const price = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;
  if (atr == null || sma50 == null || price == null || price <= 0) return null;

  const equity = cash + pos * price;
  const trendUp = price > sma50;
  // ATR-scaled crash band: 3.0 ATRs below the 50-day average. Chosen so normal
  // LINK dips (1-2 ATR) stay in the vol-target regime and only a genuine crash
  // (>3 ATR) triggers the full exit — replaces a fixed % that would whipsaw.
  const crashDist = 3.0 * atr;
  const crashStop = price < sma50 - crashDist;

  let targetQty;
  if (crashStop) {
    targetQty = 0; // real crash: exit fully
  } else if (trendUp) {
    targetQty = equity / price; // uptrend: stay fully invested
  } else {
    // mild downtrend: size to a 2% daily vol target
    const targetValue = (0.02 * equity) / (atr / price);
    targetQty = targetValue / price;
  }

  // Display-only watch declarations (no trade impact)
  const crashLevel = sma50 - crashDist;
  const watch = [];
  if (pos > 0) {
    watch.push({ side: 'sell', price: crashLevel, trigger: 'below', note: 'crash stop' });
    if (trendUp) {
      watch.push({ side: 'sell', price: sma50, trigger: 'below', note: 'trend down' });
    } else {
      watch.push({ side: 'buy', price: sma50, trigger: 'above', note: 'trend up' });
    }
  } else {
    if (crashStop) {
      watch.push({ side: 'buy', price: crashLevel, trigger: 'above', note: 'crash stop clear' });
    }
  }
  ctx.watch(watch);

  const diff = targetQty - pos;
  if (Math.abs(diff) < 0.0001 * Math.max(0.0001, pos)) return null;

  if (diff > 0) {
    const buyQty = Math.min(diff, (cash / price) * 0.98);
    if (buyQty <= 0) return null;
    return { side: 'buy', qty: buyQty };
  } else {
    return { side: 'sell', qty: Math.min(pos, -diff) };
  }
}
