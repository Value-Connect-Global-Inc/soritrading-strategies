/*
 * @coinsori-strategy v1
 * name: ETH Fed-Liquidity Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto is a risk asset that tends to do best when the Fed
 *   is easing or holding rates steady (cheap liquidity) and struggles when the
 *   Fed is actively tightening. This tests the FED LIQUIDITY regime as the entry
 *   gate instead of sentiment or the dollar — the trend core is the same one
 *   that already validated (3621/3623), only the gate is different.
 * When it buys and sells: buy on a 20-bar high close with above-average volume
 *   in an uptrend (above the 100-EMA) while the Fed is NOT tightening (the
 *   30-day-lagged fed funds rate is not higher than it was ~30 days earlier).
 *   Sell on a 20-bar low close, a 2.5x ATR hard stop, or when the close falls
 *   below the 100-EMA.
 * When it does NOT work: the fed funds rate changes only a few times a year, so
 *   the gate is slow — it can keep us out of strong melt-ups that happen while
 *   rates are flat, and it does nothing to protect against crashes that start
 *   while rates are already low.
 */
function onUpdate(ctx) {
  const fed = ctx.data('fed_lag30');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // rolling history of the (lagged) fed funds rate; NaN marks a bar with no data
  // so the 180-bar (=30 days at 4h) lookback stays aligned even across gaps
  const hist = ctx.state.fedHist || [];
  hist.push(fed == null ? NaN : fed);
  if (hist.length > 200) hist.shift();
  ctx.state.fedHist = hist;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    // trend-break exit: we only buy above the 100-EMA, so leave when that uptrend ends
    const trendBreak = prevClose < ema100;
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    if (trendBreak) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }

  // liquidity gate: skip entries while the Fed is tightening (rate higher than ~30 days ago)
  const old = hist.length >= 181 ? hist[hist.length - 181] : NaN;
  if (fed == null || isNaN(old)) return null;   // need 30 days of rate history to judge direction
  if (fed > old) return null;                   // tightening = risk-off, stay flat

  if (prevClose <= ema100) return null;      // only buy in an uptrend
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;   // enter only on a FRESH breakout
  // volume confirmation: the breakout bar must trade above its 20-bar average volume
  const volPrev = ctx.volPrev;
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) return null;
  if (volPrev < avgVol) return null;

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
