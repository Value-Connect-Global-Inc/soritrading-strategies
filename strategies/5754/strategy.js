/*
 * @coinsori-strategy v1
 * name: BTC Trend-Gated Vol-Target Daily 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The exact structure of the SOL trend-gated vol-target strategy
 * (2209) applied to BTC 1d, with NO deadband — it rebalances every bar, matching the
 * ledger champion's ~1.6 trades/bar behaviour. Full position above the 50-day average,
 * a 2%-daily-risk vol-target position below it, and cash on a 3-ATR crash. This tests
 * whether the base family transfers to BTC before any tuning.
 * When it buys and sells: Above the 50-day average it holds a full position. Between
 * the 50-day average and a 3-ATR crash band it holds a volatility-targeted position.
 * Below the crash band it exits to cash. Rebalances every bar to the target.
 * When it does NOT work: In a long sideways chop the vol-target position bleeds small
 * losses; a fast V-recovery can sell into cash near the bottom and miss the bounce.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const sma50 = ctx.sma(50, 1);
  const price = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;
  if (atr == null || sma50 == null || atr <= 0 || price == null || price <= 0) return null;

  const equity = cash + pos * price;
  const trendUp = price > sma50;
  const crashStop = price < sma50 - 3.0 * atr;

  let targetQty;
  if (crashStop) {
    targetQty = 0;
  } else if (trendUp) {
    targetQty = equity / price;
  } else {
    const targetValue = (0.02 * equity) / (atr / price);
    targetQty = targetValue / price;
  }

  const curQty = pos;
  const diff = targetQty - curQty;
  if (Math.abs(diff) < 0.0001 * Math.max(0.0001, curQty)) return null;

  ctx.watch([
    { side: 'sell', price: sma50, trigger: 'below', note: 'below SMA50 (vol-target)' },
    { side: 'sell', price: sma50 - 3.0 * atr, trigger: 'below', note: 'crash band' }
  ]);

  if (diff > 0) {
    const buyQty = Math.min(diff, (cash / price) * 0.98);
    if (buyQty <= 0) return null;
    return { side: 'buy', qty: buyQty };
  } else {
    return { side: 'sell', qty: Math.min(curQty, -diff), reduceOnly: true };
  }
}
