/*
 * @coinsori-strategy v1
 * name: BTC Trend-Gated Vol-Target Deadband 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Rides a healthy BTC trend but de-risks to a volatility target
 * when the trend turns mildly down, and exits to cash only on a real crash. A
 * rebalance deadband stops it from re-trading every single bar (my previous no-deadband
 * version churned 3000+ trades). This is the validated trend-gated vol-target family
 * that beat buy-and-hold on BTC 1d in this account's ledger.
 * When it buys and sells: Above the 50-day average it holds a full position. Between
 * the 50-day average and a 3-ATR crash band below it, it holds a volatility-targeted
 * position (risking 2% of equity per day). Below the crash band it exits to cash.
 * It only rebalances when the target position differs from the current one by more
 * than 5% (deadband), so small daily wobbles do not cause trades.
 * When it does NOT work: In a long sideways chop it keeps a small vol-targeted position
 * and bleeds small losses; a fast V-shaped recovery can sell into cash near the bottom
 * and miss the bounce. Deep drawdowns still occur in violent bull corrections.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const sma50 = ctx.sma(50, 1);
  const price = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;
  if (atr == null || sma50 == null || atr <= 0 || price == null || price <= 0) return null;

  const equity = cash + pos * price;

  // Crash band: 3.0 ATR below the SMA50 = genuine crash, exit fully to cash.
  const crashStop = price < sma50 - 3.0 * atr;

  let targetQty;
  if (crashStop) {
    targetQty = 0; // genuine crash: fully out
  } else if (price > sma50) {
    targetQty = equity / price; // healthy uptrend: fully invested
  } else {
    const targetValue = (0.02 * equity) / (atr / price); // mild downtrend: 2% daily vol-target
    targetQty = targetValue / price;
  }

  const curQty = pos;
  const diff = targetQty - curQty;

  // Deadband: only rebalance when the target differs from current by > 5% of target.
  // This is what stops the every-bar churn that destroyed my previous version.
  const db = 0.05 * Math.max(targetQty, Math.abs(curQty), 0.0001);
  if (Math.abs(diff) < db) return null;

  const band = crashStop ? sma50 - 3.0 * atr : sma50;
  ctx.watch([
    { side: 'sell', price: band, trigger: 'below', note: 'crash band (3 ATR below SMA50)' },
    { side: 'sell', price: sma50, trigger: 'below', note: 'below SMA50 (vol-target)' }
  ]);

  if (diff > 0) {
    const buyQty = Math.min(diff, (cash / price) * 0.98);
    if (buyQty <= 0) return null;
    return { side: 'buy', qty: buyQty };
  } else {
    return { side: 'sell', qty: Math.min(curQty, -diff), reduceOnly: true };
  }
}
