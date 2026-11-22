/*
 * @coinsori-strategy v1
 * name: BTC VIX Regime Filter 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Risk assets (BTC) tend to rise when stock-market fear (VIX) is low and
 * fall when fear spikes. We stay long BTC while VIX is calm relative to its
 * own recent history and move to cash when VIX turns unusually elevated.
 * Works in calm bull and choppy markets. Loses in slow grind-ups where VIX
 * drifts high for weeks without a real crash, and lags fast crashes by the
 * 2-day data lag (a 20% stop-loss caps that).
 */

function onUpdate(ctx) {
  const vix = ctx.data("base_vix");
  if (vix == null) return null;               // macro data not connected yet

  // rolling series of distinct daily VIX values (90 days of baseline)
  let s = ctx.state;
  let series = s.vixSeries || [];
  if (series.length === 0 || Math.abs(series[series.length - 1] - vix) > 1e-9) {
    series.push(vix);
    if (series.length > 90) series.shift();
    s.vixSeries = series;
  }
  if (series.length < 30) return null;        // need at least a month of history

  const mean = series.reduce((a, b) => a + b, 0) / series.length;
  let varr = 0;
  for (const v of series) varr += (v - mean) * (v - mean);
  const sd = Math.sqrt(varr / series.length);
  if (sd < 1e-9) return null;
  const z = (vix - mean) / sd;

  const px = ctx.price;

  if (ctx.position <= 0) {
    if (z < 0.5) {                            // calm fear = risk-on
      ctx.watch([{ side: 'buy', price: px, trigger: 'below', note: 'VIX calm',
                   conds: [{ label: 'VIX z-score', now: z, op: '<', ref: 0.5, closed: true }] }]);
      return { side: 'buy', qty: (ctx.cash * 0.98) / px };
    }
    ctx.watch([]);
    return null;
  }

  const entry = ctx.entryPx;
  const stop = entry == null ? 0 : entry * 0.8;   // 20% crash stop while holding
  if (z > 1.0 || (stop > 0 && px <= stop)) {      // fear spike or fast crash
    ctx.watch([{ side: 'sell', price: px, trigger: 'above', note: 'VIX elevated',
                 conds: [{ label: 'VIX z-score', now: z, op: '>', ref: 1.0, closed: true }] },
               { side: 'sell', price: stop, trigger: 'below', note: '20% crash stop' }]);
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% crash stop' }]);
  return null;
}
