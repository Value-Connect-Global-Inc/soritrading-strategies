/*
 * @coinsori-strategy v1
 * name: MultiAsset MR VIXGate 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same defensive mean-reversion basket as the validated champion, with one
 * macro-regime gate on a new axis. When global equity volatility (VIX) is spiking, crypto
 * mean-reversion dips tend to keep falling (risk-off contagion), so this version skips MR
 * entries while VIX is elevated and stays in cash until the storm passes.
 * When it buys and sells: Buy an asset when RSI is flushed (BB lower + RSI<30, or Keltner low +
 * RSI<40), its 200-day average is rising, AND the VIX is not spiking. Sell via ATR-trailing stop
 * (2.5 ATR below peak) or when price closes back above the 20-day EMA.
 * When it does NOT work: In a broad coordinated crypto bear all rising-trend gates stay flat; a
 * single straight-line melt-up lags buy-and-hold; the VIX gate can be slow to reset after a
 * crisis, missing the first strong dip of a recovery.
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

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr;
    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const uptrend = sma200 > sma200prev;
  if (!uptrend) return null;

  // VIX regime gate: skip MR entries while global vol is elevated. 25 = VIX above its
  // long-run median, i.e. risk-off contagion is likely to drag crypto dips lower.
  const vix = ctx.data("base_vix");
  if (vix != null && vix > 25) return null;

  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  if (bollingerFlush) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  if (keltnerPullback) {
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
