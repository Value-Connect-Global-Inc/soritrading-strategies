/*
 * @coinsori-strategy v1
 * name: SOL VIX-Regime Vol-Target Trend 1D
 * ex: binance
 * syms: SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto rallies tend to extend while US equity volatility (VIX) is low (risk-on),
 * and crash when VIX spikes regardless of the coin's own trend. VIX is a regime signal price alone
 * cannot see. Position size shrinks automatically when SOL's own volatility (ATR) is high, so the
 * account is never over-exposed in choppy markets.
 * When it buys and sells: It buys when SOL closes above its 200-day average AND VIX is below 28
 * (risk-on). It sells when SOL closes back below the 200-day average, when VIX jumps above 35
 * (panic), or when price falls 15% below entry as a hard stop.
 * When it does NOT work: In a slow bull where SOL trades below its 200-day average for long stretches
 * it stays in cash and misses the move. It also misses fast local rallies that happen while VIX is
 * still elevated but SOL is already recovering.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const vix = ctx.data("base_vix");
  if (sma200 == null || atr == null || vix == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // VIX < 28 = risk-on (normal/calm), VIX > 35 = panic. 28/35 chosen as standard VIX comfort/panic levels.
  const riskOn = vix < 28;
  const riskOff = vix > 35;

  if (ctx.position > 0) {
    const stop = (ctx.entryPx != null) ? ctx.entryPx * 0.85 : null; // 15% disaster stop
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
      { side: 'sell', price: null, note: 'VIX panic', conds: [{ label: 'VIX risk-off', ok: riskOff, closed: true }] }
    ]);
    if (prevClose < sma200) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (riskOff) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'SMA200 uptrend', conds: [{ label: 'VIX risk-on', ok: riskOn, closed: true }] }
  ]);
  if (riskOn && prevClose > sma200) {
    // Vol-target sizing: aim ~4% equity risk per 1 daily ATR, capped at 80% of cash.
    const qty = Math.min(0.8 * ctx.cash / ctx.price, 0.04 * ctx.cash / atr) * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
