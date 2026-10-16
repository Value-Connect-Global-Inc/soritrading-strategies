/*
 * @coinsori-strategy v1
 * name: BB Squeeze Breakout BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Volatility squeezes (Bollinger Band width compressed to a multi-month low) are
 * followed by directional expansion. This strategy times the start of that expansion instead of
 * chasing an already-running trend, so it is a different family from the OBV/turtle trend followers.
 * When it buys and sells: buys when a closed daily bar closes above the upper Bollinger band while
 * band width was in its lowest 20% over the last 100 days (a squeeze in place right before the
 * breakout) and price is above the 100-day average (uptrend context). Sells on a 2.5x ATR stop or
 * when a closed bar closes back below the middle band.
 * When it does NOT work: in prolonged low-volatility chop the squeeze fires repeatedly and each
 * breakout fails (whipsaw). It also misses strong trends that start without a prior squeeze, and
 * it stays out of downtrends entirely.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 220) return null; // need 20-bar BB window + 100-bar width history + SMA100

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const NB = c.length - 2; // index of the last CLOSED bar (ago=1)

  function avg(arr) { let s = 0; for (const v of arr) s += v; return s / arr.length; }
  function std(arr) {
    const m = avg(arr); let s = 0;
    for (const v of arr) { const d = v - m; s += d * d; }
    return Math.sqrt(s / arr.length);
  }
  // BB(20,2) width at close index i: (upper-lower)/mid = 4*sd/mid
  function widthAt(i) {
    if (i < 19) return null;
    const win = c.slice(i - 19, i + 1);
    const mid = avg(win);
    if (mid <= 0) return null;
    return (4 * std(win)) / mid;
  }

  const pos = ctx.position;

  if (pos > 0) {
    // Trailing exit: stop is the higher of (entry - 2.5 ATR) and (highest close since entry - 4 ATR).
    // 4 ATR is wide enough to survive the normal pullback after a squeeze, unlike 2.5 which churned.
    const entry = ctx.entryPx;
    let hiSince = entry == null ? -Infinity : entry;
    for (let k = 2; k <= 250; k++) {
      const v = c.at(-k);
      if (v == null) break;
      hiSince = Math.max(hiSince, v);
    }
    const floor = entry == null ? null : entry - atr * 2.5;
    const trail = hiSince - atr * 4;
    const stop = entry == null ? null : Math.max(floor, trail);
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    const mid = avg(c.slice(NB - 19, NB + 1));
    if (c[NB] < mid) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing 4x ATR stop' },
               { side: 'sell', price: mid, trigger: 'below', note: 'close below mid-BB' }]);
    return null;
  }

  // Entry: breakout on last closed bar, squeeze measured one bar earlier
  const wPrev = widthAt(NB - 1);
  if (wPrev == null) return null;
  const hist = [];
  for (let i = NB - 2; i >= NB - 101 && i >= 20; i--) {
    const w = widthAt(i);
    if (w != null) hist.push(w);
  }
  if (hist.length < 50) return null;
  hist.sort((a, b) => a - b);
  const p20 = hist[Math.floor(hist.length * 0.2)];
  const squeeze = wPrev <= p20; // band width in lowest 20% of the last 100 days

  const win = c.slice(NB - 19, NB + 1);
  const mid = avg(win);
  const sd = std(win);
  const upper = mid + 2 * sd;
  const breakout = c[NB] > upper;

  const sma100 = ctx.sma(100, 1);
  if (sma100 == null) return null;
  const trend = c[NB] > sma100; // only buy breakouts in an uptrend context

  if (!(squeeze && breakout && trend)) {
    ctx.watch([{ side: 'buy', price: upper, trigger: 'above', note: 'BB squeeze breakout',
                 conds: [{ label: 'squeeze', ok: squeeze, closed: true },
                         { label: 'above SMA100', ok: trend, closed: true }] }]);
    return null;
  }

  // ATR-scaled sizing: cut exposure when volatility is high (target 2% of price per ATR)
  const atrPct = atr / c[NB];
  const volScale = Math.min(1, 0.02 / atrPct);
  const qty = (ctx.cash * 0.95 * volScale) / price * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: upper, trigger: 'above', note: 'BB squeeze breakout' }]);
  return { side: 'buy', qty };
}
