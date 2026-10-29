/*
 * @coinsori-strategy v1
 * name: BTC Donchian 55/30 + Trend-Conditional Dollar Gate 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC is a global risk asset that tends to rally when the US
 * dollar weakens and stall when it strengthens — but that link is weak whenever
 * BTC has its own strong uptrend. This rides the proven Donchian 55/30 close-
 * channel breakout and cuts exposure (half size) to a strong dollar ONLY when BTC
 * itself is below its 200-day average, i.e. when the dollar headwind actually
 * matters. In a real BTC uptrend we stay full size, so the dollar never costs us
 * a bull market (the 2023-25 lesson from the plain dollar gate).
 * When it buys and sells: Buys a 55-day close-high break at full size when the
 * dollar is weak OR BTC is above its 200d SMA; at half size only when BTC is below
 * its 200d SMA AND the dollar is strong. Sells on a 30-day close-low break. The
 * dollar regime is ADAPTIVE (dxy vs its own trailing 60d average), not fixed.
 * When it does NOT work: In a long sideways range it whipsaws across the channel.
 * It lags sharp V-recoveries. The dollar gate can still not help in a dollar-
 * neutral choppy range, and sizing cuts can't avoid a 2022-style bear entirely.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const atr20 = ctx.atr(20, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr20 == null || sma200 == null || closes.length < 60) return null;
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

  // Adaptive dollar regime: accumulate dxy history in ctx.state (survives restart),
  // compare the latest closed dxy to its own trailing average.
  if (!ctx.state.dxyHist) ctx.state.dxyHist = [];
  const dxy = ctx.data('dxy');
  let dollarWeak = false;
  if (dxy != null && Number.isFinite(dxy) && dxy > 0) {
    ctx.state.dxyHist.push(dxy);
    if (ctx.state.dxyHist.length > 120) ctx.state.dxyHist.shift();
    const hist = ctx.state.dxyHist;
    if (hist.length >= 40) {
      let sum = 0;
      for (let i = 0; i < hist.length - 1; i++) sum += hist[i]; // exclude today's fresh value
      const avg = sum / (hist.length - 1);
      dollarWeak = dxy < avg; // dollar below its own recent average = weak dollar
    }
  }

  // BTC's own trend: above its 200d SMA = the dollar gate does NOT apply.
  const btcTrendUp = prevClose > sma200;

  const pos = ctx.position;

  ctx.watch([
    { side: 'buy', price: hi55, trigger: 'above', note: 'break 55d close high',
      conds: [ { label: 'BTC > 200d SMA', ok: btcTrendUp },
               { label: 'dollar weak (dxy<60d avg)', ok: dollarWeak } ] },
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
    // Half size ONLY when BTC has no trend of its own AND dollar strong.
    // In any real uptrend (btcTrendUp) or with a weak dollar, go full size.
    const regimeFrac = (!btcTrendUp && !dollarWeak) ? 0.5 : 1.0;
    const frac = volFrac * regimeFrac;
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
