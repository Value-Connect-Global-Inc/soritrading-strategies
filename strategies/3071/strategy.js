/*
 * @coinsori-strategy v1
 * name: Multi-Asset MR Basket 5-Asset Full-ATR-Risk-Scaled
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated 5-asset defensive MR basket (3052) captures ~5x the
 * single-asset champion's return by diversifying across BTC/ETH/SOL/XRP/BNB, but its
 * Bollinger leg still uses a fixed 20%-of-equity size, giving ~12-13% drawdown. The BTC
 * champion (3033) proved that ATR-risk-scaling ALL entries cuts drawdown from ~26% to
 * single-digit while keeping return. This combines both validated ideas: size EVERY leg
 * inversely to its ATR so high-volatility flushes get smaller positions, cutting the
 * basket's drawdown while keeping the diversification edge.
 * When it buys and sells: On each asset, buy when price closes below the lower Bollinger
 * (20,2.5) with RSI<30, or below the ATR-adaptive Keltner low (EMA20-2.5*ATR) with RSI<40,
 * only inside a rising 200-day average. Each entry risks a fixed 2.5% of equity, converted
 * to coins via that asset's ATR, capped at the 20% leg share. Sell on an ATR-trailing stop
 * (2.5 ATR below the highest close since entry) or when price closes back above the 20-day EMA.
 * When it does NOT work: In a broad coordinated crypto bear all rising-trend gates stay flat
 * (capital safe, little upside); a single straight-line melt-up of one asset still lags
 * buy-and-hold of that asset. ATR-sizing also shrinks position (and profit) in high-vol
 * recoveries, and a deep flush that keeps sliding can still be cut by the trailing stop.
 * 2025-01-10: added ctx.watch declarations — display only, trading logic unchanged.
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
    const trailStop = peak - 2.5 * atr; // 2.5 ATR below the peak = let winners run, cut reversals
    ctx.watch([
      { side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' },
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 reclaim' }
    ]);
    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower + RSI<30', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]},
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low + RSI<40', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);

  if (bollingerFlush || keltnerPullback) {
    // ATR-RISK-SCALED sizing on BOTH legs: risk a fixed 2.5% of equity per trade.
    // High-volatility flushes get smaller positions, cutting the basket's drawdown.
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20; // never exceed the 20% leg share
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
