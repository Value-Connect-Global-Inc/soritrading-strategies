/*
 * @coinsori-strategy v1
 * name: Multi-Asset Defensive MR Basket 5-Asset Conviction-Scaled
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 5-asset defensive MR basket is the validated champion, but it
 * sizes every qualifying flush the same way. Deeper oversold flushes (lower RSI, wider
 * band break) are stronger mean-reversion signals, so this version scales the position
 * up with conviction — putting more capital behind the most extreme dips.
 * When it buys and sells: On each asset, buy when price closes below the lower Bollinger
 * (20,2.5) with RSI<30 (deep = bigger), or below the ATR-adaptive Keltner low with RSI<40,
 * only inside a rising 200-day average. Position is scaled by how deep the RSI flush is.
 * Sell via an ATR-trailing stop (2.5 ATR below the highest close since entry) or when price
 * closes back above the 20-day EMA.
 * When it does NOT work: In a broad coordinated crypto bear all rising-trend gates stay
 * flat (capital safe, little upside); a straight-line melt-up of one asset still lags
 * buy-and-hold of that asset. Deep-flush over-concentration can hurt when a flush keeps
 * falling (no recovery).
 * 2025-01-02: display-only ctx.watch added; trading logic unchanged.
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
    const trailStop = peak - 2.5 * atr;
    ctx.watch([
      { side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' },
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 exit' },
      { side: 'sell', price: peak, trigger: 'above', note: 'peak (trail ref)' },
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower' },
      { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low' },
    ]);
    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!uptrend) return null;

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  if (bollingerFlush || keltnerPullback) {
    // Conviction scale: the deeper the RSI flush (lower RSI), the bigger the position.
    // RSI 40 -> 0.5x, RSI 20 -> 1.0x, RSI 10 -> 1.3x. Linear ramp capped at 1.3x.
    const r = Math.max(10, Math.min(40, rsi));
    const conv = 0.5 + (40 - r) / (40 - 10) * 0.8;
    const maxQty = (ctx.cash / price) * 0.20 * conv; // 20% leg share scaled by conviction
    // Also scale the risk budget so deeper flushes risk proportionally more.
    const riskBudget = 0.025 * ctx.cash * conv;
    let qty = Math.min(riskBudget / atr, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.watch([
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
        { label: 'SMA200 rising', ok: uptrend },
      ]},
      { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low', conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'SMA200 rising', ok: uptrend },
      ]},
      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 exit' },
      { side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: 'initial trail' },
    ]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
      { label: 'SMA200 rising', ok: uptrend },
    ]},
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low', conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'SMA200 rising', ok: uptrend },
    ]},
  ]);
  return null;
}
