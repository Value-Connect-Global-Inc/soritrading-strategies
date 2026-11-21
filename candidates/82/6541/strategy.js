/*
 * @coinsori-strategy v1
 * name: BTC Regime-Filter Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC trends persist for weeks at a time, and the biggest losses come from staying long through a downtrend. A slow regime filter that steps aside when the medium trend turns down should keep most of an uptrend's return while cutting the drawdown.
 * When it buys and sells: buys when the 200-bar EMA is rising and price closes 2% above it; sells (steps aside to cash) when price closes 2% below the EMA. The 2% band is deliberate hysteresis so choppy price never triggers in-and-out whipsaw. A stop of 3x ATR caps any single losing position.
 * When it does NOT work: in a long sideways market the band still whipsaws and pays fees without a trend to ride — this loses to holding in flat regimes.
 */
function onUpdate(ctx) {
  const ema = ctx.ema(200, 1);
  const emaPrev = ctx.ema(200, 2);
  const prevClose = ctx.closes.at(-2);
  const atr = ctx.atr(14, 1);
  if (ema == null || emaPrev == null || prevClose == null || atr == null) return null;

  const pos = ctx.position || 0;

  // hysteresis band: enter only 2% above EMA, exit only 2% below (anti-whipsaw)
  const enterLvl = ema * 1.02;
  const exitLvl = ema * 0.98;

  // ATR-based stop: 3x ATR below entry (BTC 4h ATR ~2-3% of price -> ~6-9% stop)
  let stop = null;
  if (pos > 0 && ctx.entryPx != null) {
    stop = ctx.entryPx - 3 * atr;
  }

  ctx.watch([
    { side: 'buy', price: enterLvl, trigger: 'above', note: 'EMA200+2% band', conds: [{ label: 'EMA200 rising', ok: ema > emaPrev, closed: true }] },
    { side: 'sell', price: exitLvl, trigger: 'below', note: 'EMA200-2% band' },
    ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' }] : [])
  ]);

  // exit: ATR stop first
  if (pos > 0 && stop != null && ctx.price <= stop) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // exit: price closes below the lower band -> step aside
  if (pos > 0 && prevClose < exitLvl) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // entry: price above upper band and EMA rising -> go long
  if (pos === 0 && prevClose > enterLvl && ema > emaPrev) {
    const qty = (ctx.cash / ctx.price) * 0.95;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }

  return null;
}
