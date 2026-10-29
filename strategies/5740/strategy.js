/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/30 + Adaptive Dollar Gate 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC is a global risk asset that tends to rally when the US
 * dollar weakens and stall/fall when the dollar strengthens. This strategy rides
 * the proven Donchian 55/30 close-channel breakout but cuts exposure (halves
 * position) when the dollar is in a strengthening regime, to cut drawdown.
 * When it buys and sells: Buys a 55-day close-high breakout near full size when
 * the dollar is weak (dxy below its own 60-day average) and at half size when the
 * dollar is strong. Sells on a 30-day close-low break. The dollar gate is ADAPTIVE
 * (dxy vs its own trailing average), not a fixed level, because the dollar's
 * structural level drifts over the years.
 * When it does NOT work: In a strong dollar rally where BTC still trends up (e.g.
 * 2023-2025), the gate wrongly holds back size and underperforms the plain
 * breakout. It also can't help in a dollar-neutral choppy range.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const atr20 = ctx.atr(20, 1);
  if (atr20 == null || closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  // Donchian channels over CLOSED bars before prevClose (exclude index -2)
  let hi55 = -Infinity;
  for (let k = closes.length - 56; k < closes.length - 2; k++) {
    if (closes[k] > hi55) hi55 = closes[k];
  }
  let lo30 = Infinity;
  for (let k = closes.length - 31; k < closes.length - 2; k++) {
    if (closes[k] < lo30) lo30 = closes[k];
  }

  // Adaptive dollar regime: dxy level vs its own 60-day average (closed values).
  // dxy is a dataset key (state=ok). Use closed bars so no look-ahead.
  let dollarWeak = true; // default: no gate (behave like plain breakout)
  const dxy = ctx.data('dxy');
  if (dxy != null && Array.isArray(dxy) && dxy.length >= 2) {
    const dxyNow = dxy.at(-2);       // last closed dxy observation
    const dxyPrev = dxy.at(-3);
    if (dxyNow != null && dxyPrev != null) {
      // dxy is daily; take a simple adaptive reference as its own recent mean.
      // We approximate the 60-day average from available history.
      let sum = 0, cnt = 0;
      for (let k = Math.max(0, dxy.length - 61); k < dxy.length - 1; k++) {
        if (dxy[k] != null) { sum += dxy[k]; cnt++; }
      }
      if (cnt >= 30) {
        const avg = sum / cnt;
        dollarWeak = dxyNow < avg;   // dollar below its own average = weak dollar regime
      }
    }
  }

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: hi55, trigger: 'above', note: 'break 55d close high' },
    { side: 'sell', price: lo30, trigger: 'below', note: 'break 30d close low' }
  ]);

  if (pos > 0) {
    if (prevClose < lo30) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevClose > hi55) {
    const atrPct = atr20 / price;
    const volFrac = Math.min(1, 0.03 / atrPct);
    // Halve size when the dollar regime is strong, full size when weak.
    const regimeFrac = dollarWeak ? 1.0 : 0.5;
    const frac = volFrac * regimeFrac;
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
