/*
 * @coinsori-strategy v1
 * name: ETH Sentiment-Gated Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: buy 20-bar breakouts in an uptrend when crypto sentiment
 *   is not at a blow-off top AND the US dollar is not strengthening. Built on
 *   the version that added a trend-break exit to cut deep drawdowns; this cycle
 *   adds a dollar-strength regime filter (risk-off for crypto).
 * When it buys and sells: buy when Fear&Greed < 75, price above the 100-EMA, a
 *   fresh 20-bar high closes, and DXY is below its own recent average. Sell on a
 *   20-bar low close, a 2.5x ATR hard stop, or when the close falls back below
 *   the 100-EMA. Missing DXY data = gate skipped (no entry block).
 * When it does NOT work: misses melt-ups (sentiment/dollar gates stay out), the
 *   trend-break exit can cut strong trends short, and the dollar filter can keep
 *   it out during late-bull phases while the dollar is still firm.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  // rolling DXY regime: only allow entries while the dollar trades below its own
  // recent average (dollar strength = crypto risk-off). Missing data => gate off.
  const dxy = ctx.data('dxy');
  let dxyHist = ctx.state.dxyHist || [];
  if (dxy != null) {
    dxyHist.push(dxy);
    if (dxyHist.length > 180) dxyHist.shift();  // 180 bars ~ 30 days of DXY
    ctx.state.dxyHist = dxyHist;
  }
  let dxyGate = true;
  if (dxy != null && dxyHist.length >= 60) {    // need ~10 days of history to judge
    const avg = dxyHist.reduce((a, b) => a + b, 0) / dxyHist.length;
    dxyGate = dxy < avg;
  }

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

  if (fg != null && fg >= 75) return null;   // only a blow-off top blocks entry (fg null = data off, skip gate)
  if (!dxyGate) return null;                 // dollar strengthening = skip new entries
  if (prevClose <= ema100) return null;      // only buy in an uptrend
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;   // enter only on a FRESH breakout

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
