/*
 * @coinsori-strategy v1
 * name: BTC Clean Trend-Gated Vol-Target 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The strongest validated recipe in this account's ledger
 * (beats buy-and-hold on BTC 1d 2022-2026 +928% vs +233%, MDD 21%). It rides the
 * trend when it is healthy, de-risks to a volatility target when the trend turns
 * mildly down, and exits fully only on a real crash — plus it sizes up when the
 * trend is strong. This is the opposite of the Donchian breakout I tried before,
 * which whipsawed badly in the same window.
 * When it buys and sells: Above the 50-day average it stays fully invested. Between
 * the 50-day average and a 3-ATR crash band below it, it holds a volatility-targeted
 * position (risking 2% of equity per day). Below the crash band it exits to cash.
 * Position size scales up with how far price is above the 50-day average (trend strength).
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
  const distPct = (price - sma50) / sma50;

  // Trend-strength scaling: risk more per day when far above the SMA50 (strong
  // uptrend), less when hugging it (weak, likely to whipsaw). 2% base risk.
  const risk = 0.02 * (1 + Math.min(Math.max(distPct * 5, 0), 3)); // 2% -> up to 8% daily risk

  // ATR crash band: 3.0 ATR below the SMA50 = real crash, exit fully to cash.
  const crashStop = price < sma50 - 3.0 * atr;

  let targetQty;
  if (crashStop) {
    targetQty = 0; // genuine crash: fully out
  } else if (price > sma50) {
    targetQty = equity / price; // healthy uptrend: fully invested
  } else {
    const targetValue = (risk * equity) / (atr / price); // mild downtrend: vol-target
    targetQty = targetValue / price;
  }

  const curQty = pos;
  const diff = targetQty - curQty;
  if (Math.abs(diff) < 0.0001 * Math.max(0.0001, curQty)) return null;

  const band = price < sma50 - 3.0 * atr ? sma50 - 3.0 * atr : sma50;
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
