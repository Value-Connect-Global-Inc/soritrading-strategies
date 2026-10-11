/*
 * @coinsori-strategy v1
 * name: BTC DXY Macro Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin behaves like an anti-dollar asset. When the
 *   Dollar Index (DXY) is below its 200-day average, the dollar is weak and
 *   risk assets including BTC tend to trend up; when DXY is above its long
 *   average, the dollar is strong and BTC usually stalls or falls. We hold
 *   BTC only while the dollar is structurally weak AND BTC is trending up.
 * When it buys and sells: buy when DXY is below its 200-day average AND price
 *   is above its 50-day average; sell when price closes below its 50-day EMA,
 *   when DXY rises back above its 200-day average, or on a 3x ATR stop from
 *   entry. Position is near-full when the regime is on.
 * When it does NOT work: when BTC and the dollar decouple (BTC rallies while
 *   DXY stays high, e.g. 2023-24), the gate keeps it out of part of the bull
 *   run and it lags buy-and-hold. In choppy dollar ranges the 200-day average
 *   whipsaws. It is a defensive regime strategy, not a bull maximizer.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const m = ctx.macro('dxy');
  if (!m || typeof m.value !== 'number' || !isFinite(m.value)) return null;
  const dxy = m.value;

  // Accumulate daily DXY values to compute a 200-day average ourselves.
  if (!ctx.state.dxyHist) ctx.state.dxyHist = [];
  ctx.state.dxyHist.push(dxy);
  if (ctx.state.dxyHist.length > 260) ctx.state.dxyHist.shift();
  const hist = ctx.state.dxyHist;
  if (hist.length < 200) return null; // need 200 days of DXY before judging the dollar

  const dxySma = hist.reduce((a, b) => a + b, 0) / hist.length;
  const dollarWeak = dxy < dxySma;

  const ema50 = ctx.ema(50, 1);
  const sma50 = ctx.sma(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || sma50 == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 3 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };   // hard stop
    if (price < ema50) return { side: 'sell', qty: pos };     // trend broken
    if (!dollarWeak) return { side: 'sell', qty: pos };       // dollar strengthening
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: 'trend exit' }]);
    return null;
  }

  if (!dollarWeak) return null;   // dollar strong = no longs
  if (price <= sma50) return null; // still falling — don't catch the knife

  const qty = (ctx.cash / price) * 0.95;  // near-full position when regime is on
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
