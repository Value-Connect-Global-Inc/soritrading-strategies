/*
 * @coinsori-strategy v1
 * name: MultiAsset MR Basket Cooldown 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Validated 5-asset defensive mean-reversion basket with a re-entry
 * cooldown. After selling an asset, it waits 10 bars before buying that asset again, so it
 * does not catch the same falling knife repeatedly in a sustained decline. Entry and exit
 * logic otherwise identical to the champion.
 * When it does NOT work: In a broad coordinated crypto bear all rising-trend gates stay flat;
 * in a straight-line melt-up the half-exit caps the winner below buy-and-hold.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
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
  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const entry = ctx.entryPx;
    const halfSold = ctx.state.halfSold === true;
    const trailMult = halfSold ? 1.5 : 2.5;
    const trailStop = peak - trailMult * atr;
    const profitTarget = entry != null && entry > 0 ? entry + 1.5 * atr : null;
    const watchList = [{ side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' },
                      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 exit' }];
    if (!halfSold && profitTarget != null) watchList.push({ side: 'sell', price: profitTarget, trigger: 'above', note: 'half profit target' });
    ctx.watch(watchList);
    if (!halfSold && profitTarget != null && price >= profitTarget) {
      ctx.state.halfSold = true;
      const halfQty = pos / 2;
      if (halfQty > 0) return { side: 'sell', qty: halfQty, reduceOnly: true };
    }
    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      ctx.state.halfSold = false;
      ctx.state.cooldownUntil = ctx.i + 10; // do not re-buy this asset for 10 bars
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  // Re-entry cooldown: skip this asset for 10 bars after a full exit, to avoid catching
  // the same falling knife repeatedly in a sustained decline (robustness, not fitted).
  if (ctx.state.cooldownUntil != null && ctx.i < ctx.state.cooldownUntil) return null;
  if (uptrend) {
    ctx.watch([{ side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower + RSI<30' },
              { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low + RSI<40' }]);
  }
  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;
  if (bollingerFlush) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.state.halfSold = false;
    return { side: 'buy', qty: qty };
  }
  if (keltnerPullback) {
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.state.halfSold = false;
    return { side: 'buy', qty: qty };
  }
  return null;
}
