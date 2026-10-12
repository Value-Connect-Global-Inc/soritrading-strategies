/*
 * @coinsori-strategy v1
 * name: ETH Dollar-Regime Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: risk assets (crypto) tend to rally when the US dollar is
 *   weak and stall when the dollar strengthens. This tests the MACRO regime as
 *   the entry gate instead of sentiment — the trend core is the same one that
 *   already validated (3621), only the gate is different.
 * When it buys and sells: buy on a 20-bar high close with above-average volume
 *   in an uptrend (above the 100-EMA) while the dollar is NOT rising. Sell on a
 *   20-bar low close, a 2.5x ATR hard stop, or when the close falls below the
 *   100-EMA.
 * When it does NOT work: the dollar level is a rough risk gauge, not a precise
 *   signal — in liquidity-driven rallies where crypto and the dollar rise
 *   together the gate adds nothing, and it can keep us out of strong melt-ups.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const dxyPrev = ctx.state.dxyPrev;   // DXY value from the previous bar (persisted)
  ctx.state.dxyPrev = dxy;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

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

  // macro gate: skip entries while the dollar is strengthening (risk-off regime)
  if (dxy == null || dxyPrev == null) return null;   // need two DXY readings to judge direction
  if (dxy > dxyPrev) return null;                    // dollar rising = risk-off, stay flat

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
