/*
 * @coinsori-strategy v1
 * name: DXY Macro Regime BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin is a risk asset that historically does well when
 * the US dollar weakens and badly when the dollar strengthens (2018 and 2022
 * crashes both coincided with a rising dollar). Instead of predicting price, we
 * read the macro regime directly from the Fed's broad dollar index and stay
 * long only during dollar weakness.
 * When it buys and sells: buys BTC (full size) when the dollar index is below
 * its own 200-day average (dollar weakening = risk-on); sells when the dollar
 * index rises back above its average (risk-off) or price drops 20% from entry.
 * When it does NOT work: the dollar-BTC link is noisy and not 1:1 — during a
 * dollar-driven selloff it exits late, and in a rising dollar it sits in cash
 * while BTC rallies on its own (missed the 2023-25 bull partially). It also
 * has no position when DXY data is missing.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // Read the current dollar index value, tolerating either a plain number
  // or an object carrying the number (API shape not documented).
  const m = ctx.macro('dxy');
  let dxy = null;
  if (typeof m === 'number') dxy = m;
  else if (m != null && typeof m === 'object') {
    if (typeof m.value === 'number') dxy = m.value;
    else if (typeof m.v === 'number') dxy = m.v;
  }
  if (dxy == null) return null;

  // Build the 200-day average of the dollar index from the full series.
  const series = ctx.macroSeries;
  let vals = null;
  if (Array.isArray(series)) {
    vals = [];
    for (let i = series.length - 200; i < series.length; i++) {
      if (i < 0) continue;
      const x = series[i];
      if (typeof x === 'number') vals.push(x);
      else if (x != null && typeof x === 'object') {
        if (typeof x.value === 'number') vals.push(x.value);
        else if (typeof x.v === 'number') vals.push(x.v);
      }
    }
  }
  if (vals == null || vals.length < 120) return null;
  const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
  const riskOn = dxy < avg; // dollar below its 200-day average = risk-on regime

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 20% hard stop: caps any single position's loss before the slow daily
      // dollar index can confirm the regime has flipped.
      const stopPx = entry * 0.80;
      if (price <= stopPx) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'stop: -20%' }]);
    }
    if (!riskOn) return { side: 'sell', qty: pos }; // dollar strengthening -> exit
    return null;
  }

  if (riskOn) {
    ctx.watch([{ side: 'buy', note: 'enter: DXY below 200d avg', conds: [{ label: 'DXY<200d avg', ok: riskOn, closed: true }] }]);
    return { side: 'buy', qty: (ctx.cash * 0.95) / price };
  }
  ctx.watch([{ side: 'buy', note: 'enter: DXY below 200d avg', conds: [{ label: 'DXY<200d avg', ok: riskOn, closed: true }] }]);
  return null;
}
