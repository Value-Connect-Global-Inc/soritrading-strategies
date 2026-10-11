/*
 * @coinsori-strategy v1
 * name: Multi-Asset Defensive MR Basket 5-Asset Pure-ATR-Trail
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion's EMA20 exit fires as soon as price recovers above the
 * 20-day average, which can cut a recovering winner short. This variant drops the EMA20
 * exit and relies ONLY on the 2.5-ATR trailing stop, so a recovery is allowed to run to
 * the ATR trail (or a reversal) instead of being stopped at the EMA.
 * When it buys and sells: Same entries as the champion (Bollinger flush RSI<30 or Keltner
 * pullback RSI<40, rising 200-day average, fixed 20% leg share). Exits ONLY via the
 * 2.5-ATR trailing stop below the highest close since entry — no EMA exit.
 * When it does NOT work: In a slow grind-up that never pulls back 2.5 ATR from the peak,
 * positions can be held much longer than with the EMA exit, tying up capital and giving
 * back gains on a slow reversal. Risk of holding through a full round-trip.
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const ema20 = ctx.ema(20, 1);
  const keltnerLow = ema20 - 2.5 * atr;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: 'Pure ATR trail stop' }]);
    if (price < trailStop) { // pure ATR trail, no EMA exit
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
    {
      side: 'buy',
      price: lowerBand,
      trigger: 'below',
      note: 'Bollinger flush',
      conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true }]
    },
    {
      side: 'buy',
      price: keltnerLow,
      trigger: 'below',
      note: 'Keltner pullback',
      conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true }]
    }
  ]);

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
