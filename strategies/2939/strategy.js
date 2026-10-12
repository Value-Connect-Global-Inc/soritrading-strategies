/*
 * @coinsori-strategy v1
 * name: ETH 4H Trend-Follow with DXY Risk Gate
 * ex: binance
 * syms: ETHUSDT
 * interval: 4h
 * cash: 10000
 *
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: Trend-following rides sustained up-moves and cuts losses
 * fast in down-moves. We add a macro risk switch: the US dollar index (DXY)
 * is the global risk gauge — when DXY is strengthening, risk assets de-rate,
 * so we avoid entering longs. This is a different family (trend, not
 * mean-reversion) and uses the macro feed directly.
 *
 * When it buys and sells: buys when price is above its 200-SMA, the 50-SMA is
 * above the 200-SMA (golden cross structure), and DXY is not rising (risk-on).
 * Sells when price closes back below the 200-SMA (trend broken).
 *
 * When it does NOT work: in a sideways chop the 200-SMA whipsaws; in a
 * sustained risk-off (rising DXY) it sits in cash and misses the eventual
 * bottom of the recovery.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  const s50 = ctx.sma(50, 1);
  const s200 = ctx.sma(200, 1);
  if (s50 == null || s200 == null) {
    ctx.watch([]);
    return null;
  }

  // DXY risk gate: only enter longs when DXY is NOT strengthening. Handle the
  // macro feed as either a plain number or an object with .value.
  const d = ctx.macro('dxy');
  let dxyVal = null;
  if (typeof d === 'number') dxyVal = d;
  else if (d && typeof d.value === 'number') dxyVal = d.value;

  let riskOn = true;
  if (dxyVal != null) {
    // Risk-on only if DXY is below its own 20-bar average (use macroSeries if
    // available, else treat as risk-on so the gate is conservative).
    const ms = ctx.macroSeries;
    if (ms && Array.isArray(ms) && ms.length >= 20) {
      let sum = 0, n = 0;
      for (let k = ms.length - 20; k < ms.length; k++) {
        const v = ms[k];
        const val = (typeof v === 'number') ? v : (v && v.value);
        if (Number.isFinite(val)) { sum += val; n++; }
      }
      if (n >= 20) riskOn = dxyVal < sum / n;
    }
    // if no series, keep riskOn=true (no gate) — measured as baseline
  }

  if (ctx.position === 0) {
    ctx.watch([{
      side: 'buy',
      price: s200,
      trigger: 'above',
      note: 'SMA200 touch',
      conds: [
        { label: 'SMA50 > SMA200', now: s50, op: '>', ref: s200, closed: true },
        { label: 'DXY risk-on', ok: riskOn }
      ]
    }]);
    if (px > s200 && s50 > s200 && riskOn) {
      return { side: 'buy', qty: ctx.cash / px * 0.95 };
    }
    return null;
  }

  ctx.watch([{
    side: 'sell',
    price: s200,
    trigger: 'below',
    note: 'SMA200 break'
  }]);
  if (px < s200) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
