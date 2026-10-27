/*
 * @coinsori-strategy v1
 * name: XRP Mean-Reversion Dip Buy 1D
 * ex: binance
 * syms: XRP/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The always-invested vol-target basket is the validated champion, but
 * this is a different family — mean reversion. XRP spends long stretches ranging (no strong
 * trend), so buying oversold dips inside a rising 200-day average and selling the snap-back
 * to the 20-day EMA has historically worked better than trend-following on this coin.
 * When it buys and sells: Buy when price closes below the lower Bollinger (20,2.5) with
 * RSI(14)<30 OR below the Keltner low (EMA20 - 2.5*ATR) with RSI<40, only while the 200-day
 * average is rising. Sell when price closes back above the 20-day EMA or on an ATR trailing
 * stop (2.5 ATR below the highest close since entry).
 * When it does NOT work: In a strong downtrend the rising-SMA200 gate keeps it flat (safe,
 * no upside). A straight-line melt-up never triggers a dip so it lags buy-and-hold badly.
 * The trail can whipsaw an early volatile recovery after a deep flush.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) return null;

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  const pos = ctx.pos('XRP/USDT');
  if (pos > 0) {
    // Track the highest close since entry so the trail is anchored to the real peak.
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr; // 2.5 ATR below the peak = let winners run, cut reversals
    ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail' },
               { side: 'sell', note: 'snap-back above EMA20' }]);
    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (!uptrend) return null;

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  if (bollingerFlush) {
    const qty = (ctx.cash / price) * 0.20; // one fifth of cash per dip (max 5 positions)
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.watch([{ side: 'buy', note: 'BB lower flush & RSI<30' }]);
    return { side: 'buy', qty: qty };
  }
  if (keltnerPullback) {
    // 2.5% of equity risked per leg, inverse-ATR sized, capped at the 20% leg share.
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.watch([{ side: 'buy', note: 'Keltner pullback & RSI<40' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
