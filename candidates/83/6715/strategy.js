/*
 * @coinsori-strategy v1
 * name: BTC Macro-Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like a risk asset, so its bull and bear phases line up with
 * global risk appetite. This strategy only buys when the NASDAQ-100 is above its own recent average
 * (risk appetite on) AND Bitcoin's own 4h trend is up, so it rides bull markets and stays in cash
 * during bear markets instead of buying falling knives.
 * When it buys and sells: buys on a fresh close above the 50-bar average while risk appetite is on;
 * sells when the close falls back below the 50-bar average or a 15% hard stop is hit. Once risk
 * appetite turns off it stops buying, so it never re-enters bear-market rallies.
 * When it does NOT work: sideways chop where the 50-bar average crosses back and forth (fees pile up),
 * and crypto-only crashes that leave the NASDAQ untouched (e.g. May 2021) where only the trend exit
 * protects the position.
 */
function onUpdate(ctx) {
  // --- macro regime: NASDAQ-100 vs its own recent average (risk appetite) ---
  const ndx = ctx.data("base_ndx");
  let hist = (ctx.state && Array.isArray(ctx.state.ndxHist)) ? ctx.state.ndxHist.slice() : [];
  if (ndx != null) {
    hist.push(ndx);
    if (hist.length > 60) hist = hist.slice(-60);
  }
  ctx.state = ctx.state || {};
  ctx.state.ndxHist = hist;

  // risk-on only when the latest NDX is above the average of the PREVIOUS readings,
  // so the signal never includes itself (no look-ahead)
  let riskOn = false;
  if (ndx != null && hist.length >= 21) {
    const prev = hist.slice(0, -1);
    const mean = prev.reduce((a, b) => a + b, 0) / prev.length;
    riskOn = ndx > mean;
  }

  // --- crypto trend: 50-bar EMA on 4h (~8 days), read from CLOSED bars ---
  const ema = ctx.ema(50, 1);
  const emaPrev = ctx.ema(50, 2);
  const prevClose = ctx.closes.at(-2);
  const prevClose2 = ctx.closes.at(-3);
  if (ema == null || emaPrev == null || prevClose == null || prevClose2 == null) return null;

  const pos = ctx.position || 0;
  const entryPx = ctx.entryPx;
  const price = ctx.price;

  // --- hard stop: 15% below entry, backstop for fast crashes (EMA exit usually fires first) ---
  let stopPx = null;
  if (pos > 0 && entryPx != null) stopPx = entryPx * 0.85;

  const watch = [];
  let order = null;

  if (pos > 0) {
    // exit: trend break on a closed bar, or hard stop on the current price
    const crossDown = prevClose < ema;
    const stopHit = stopPx != null && price <= stopPx;
    watch.push({ side: 'sell', price: ema, trigger: 'below', note: 'EMA50 break' });
    if (stopPx != null) watch.push({ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop 15%' });
    if (crossDown || stopHit) {
      order = { side: 'sell', qty: pos, reduceOnly: true };
    }
  } else {
    // entry: fresh close above the EMA while risk appetite is on
    const crossUp = prevClose > ema && prevClose2 <= emaPrev;
    watch.push({ side: 'buy', price: ema, trigger: 'above', note: 'EMA50 cross up',
                 conds: [{ label: 'NDX risk-on', ok: riskOn }] });
    if (riskOn && crossUp) {
      order = { side: 'buy', qty: ctx.cash / price * 0.99 };
    }
  }

  ctx.watch(watch);
  return order;
}
