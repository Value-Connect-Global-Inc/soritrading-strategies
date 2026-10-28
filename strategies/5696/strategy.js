/*
 * @coinsori-strategy v1
 * name: BTC Volume-Confirmed Breakout 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Breakouts that happen on heavy volume tend to be the start of a real move, while low-volume breakouts are often head-fakes. Buying a 55-day high breakout only when volume is also well above its own average filters out the fakeouts.
 * When it buys and sells: It buys when price closes above its 55-day high AND that bar's volume is above 1.5x its 30-day average. It sells when price closes below its 20-day low, or falls 20% below the entry as a disaster stop.
 * When it does NOT work: In low-volume grinding bulls almost no entry fires, so it sits in cash and misses the move. In a sharp crash the 20-day low exit lags, so the 20% hard stop is what caps the damage.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  const vols = ctx.volumes;
  if (!closes || !vols || closes.length < 60 || vols.length < 40) return null;
  const prevClose = closes.at(-2);
  const prevVol = vols.at(-2);
  if (prevClose == null || prevVol == null) return null;

  // 55-day high of closes BEFORE the previous bar (excludes prevClose, so the breakout is real)
  const upper = Math.max(...closes.slice(-57, -2));
  // 20-day low of closes BEFORE the previous bar
  const lower = Math.min(...closes.slice(-22, -2));
  // 30-day average volume ending 2 bars back (excludes current and previous bars)
  const volWindow = vols.slice(-32, -2);
  const avgVol = volWindow.length ? volWindow.reduce((s, x) => s + x, 0) / volWindow.length : prevVol;
  const volConfirmed = prevVol > 1.5 * avgVol; // 1.5x: heavy participation, not noise

  if (ctx.position > 0) {
    const hardStop = (ctx.entryPx != null) ? ctx.entryPx * 0.8 : null; // 20% disaster stop
    ctx.watch([
      { side: 'sell', price: lower, trigger: 'below', note: '20-day low exit' },
      { side: 'sell', price: hardStop, trigger: 'below', note: '20% disaster stop' }
    ]);
    if (prevClose < lower) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (hardStop != null && prevClose < hardStop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  ctx.watch([
    { side: 'buy', price: upper, trigger: 'above', note: '55-day high break', conds: [{ label: 'volume > 1.5x avg', ok: volConfirmed, closed: true }] }
  ]);
  if (prevClose > upper && volConfirmed) {
    // 90% of cash per entry; the 20% stop keeps a losing trade at ~18% of the account
    const qty = (0.9 * ctx.cash) / ctx.price * 0.99;
    return { side: 'buy', qty: qty };
  }
  return null;
}
