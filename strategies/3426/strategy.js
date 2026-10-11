/*
 * @coinsori-strategy v1
 * name: BTC Macro Regime Momentum 4H
 * ex: binance
 * syms: BTC
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto uptrends tend to persist while the US dollar is weak (risk-on). When BTC is above its long-term trend AND the dollar index is below its own recent average, the macro tailwind supports the move.
 * When it buys and sells: Buys when price closes above the 200-SMA while the dollar index is below its 90-bar average. Sells when price closes back below the 200-SMA (trend break) or the dollar turns risk-off (DXY above its average).
 * When it does NOT work: Sideways chop where price keeps crossing the 200-SMA causes whipsaws. If the dollar and BTC decouple (dollar down but BTC also falling), the filter gives false confidence.
 */
function onUpdate(ctx) {
  // --- trend gate: 200-SMA on CLOSED bars (ago>=1 identical live/backtest) ---
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);       // last closed bar

  // --- macro regime: DXY vs its own trailing mean (90 bars ~ 15 days) ---
  const dxy = ctx.macro('dxy');
  if (dxy == null) return null;
  const hist = ctx.state.dxyHist || [];
  hist.push(dxy);
  if (hist.length > 90) hist.shift();
  ctx.state.dxyHist = hist;
  if (hist.length < 90) return null;          // warmup for the macro mean
  const dxyMean = hist.reduce(function (a, b) { return a + b; }, 0) / hist.length;
  const riskOn = dxy < dxyMean;               // dollar below its own mean = risk-on

  // --- exits first ---
  if (ctx.position > 0) {
    if (prevClose < sma200 || !riskOn) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // --- entry: above long-term trend AND macro risk-on ---
  if (prevClose > sma200 && riskOn) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  return null;
}
