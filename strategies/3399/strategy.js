/*
 * @coinsori-strategy v1
 * name: BTC Macro-Regime Trend DXY 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A genuinely different signal source — the US Dollar index (DXY)
 * instead of crypto price or volume. When the dollar weakens, risk assets including
 * crypto tend to rally; when the dollar strengthens, they bleed. Hypothesis: gating
 * a plain BTC trend trade on a weakening dollar (DXY falling) avoids longs into a
 * risk-off dollar rally, which is when crypto crashes hardest.
 * When it buys and sells: buys when BTC closes above its 50-day average AND the DXY
 * is lower than it was ~30 days ago (dollar weakening). Sells when BTC closes back
 * below its 50-day average, or price falls 2.5 ATR below entry (hard stop).
 * When it does NOT work: In a crypto bull driven by internal adoption regardless of
 * the dollar, the DXY gate keeps you out of early strength; in a choppy sideways
 * market the 50-day flip whipsaws. DXY data may be missing on some venues — then the
 * gate is off and it behaves like a plain SMA50 trend (no filter, no harm).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  if (closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (sma50 == null || atr == null || atr <= 0) return null;

  // DXY regime: dollar weakening = risk-on. If DXY is missing (null), no filter.
  const dxyNow = ctx.macro('dxy');
  let dxyOk = true;
  if (dxyNow != null && Number.isFinite(dxyNow)) {
    let dxyAvg = null;
    const series = ctx.macroSeries;
    if (Array.isArray(series)) {
      const vals = [];
      for (let k = series.length - 1; k >= 0 && vals.length < 30; k--) {
        const v = typeof series[k] === 'object' && series[k] != null ? series[k].v : series[k];
        if (typeof v === 'number' && Number.isFinite(v)) vals.push(v);
      }
      if (vals.length >= 20) dxyAvg = vals.reduce((a, b) => a + b, 0) / vals.length;
    }
    // Filter only fires when we have a real DXY level; if the series is empty,
    // fall back to comparing the current level to 100 (long-run neutral zone).
    if (dxyAvg != null) dxyOk = dxyNow < dxyAvg;
    else dxyOk = dxyNow < 100;
  }

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' },
               { side: 'sell', price: sma50, trigger: 'below', note: 'SMA50 trend exit' }]);
    if (prevClose < sma50 || price < stop) return { side: 'sell', qty: pos };
    return null;
  }

  if (prevClose > sma50 && dxyOk) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
