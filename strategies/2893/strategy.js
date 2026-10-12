/*
 * @coinsori-strategy v1
 * name: FedGate Keltner MR Daily
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The validated Keltner mean-reversion champion buys deep
 * flushes to the lower band above the 200-day trend. This variant adds a
 * monetary-policy regime gate from the user's working fed funds dataset:
 * crypto (a risk asset) tends to struggle when the Fed is RAISING rates
 * (tightening liquidity), so entries are only taken when policy is easing or
 * neutral. This is a genuinely untested axis — macro monetary policy.
 * When it buys and sells: buys a flush to the lower Keltner band (EMA20 - 2.5x
 * ATR) with RSI<40, price above the 200-day average, AND fed funds not rising
 * (current rate <= rate 30 periods ago); sells on the snap-back to EMA20.
 * When it does NOT work: if the fed data feed is null (alignment issue) the
 * gate silently does nothing and it equals the champion; and in a melt-up
 * driven by easing it may miss entries right before a hawkish surprise.
 * 2026-04-08: 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  ctx.watch([]);
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || atr == null || sma200 == null || rsi == null || atr <= 0) return null;

  // Fed regime gate: only buy when fed funds is NOT rising (easing/neutral = risk-on).
  // Uses the user's working fed dataset; null = data unknown, let the MR decide.
  const fedNow = ctx.data('fed');
  const fedPast = ctx.data('fed_lag30');
  let fedGate = true;
  if (fedNow != null && fedPast != null && Number.isFinite(fedNow) && Number.isFinite(fedPast)) {
    fedGate = fedNow <= fedPast * 1.01;
  }

  const lower = ema20 - 2.5 * atr;
  const st = ctx.state;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', qty: pos, price: ema20, trigger: 'above', note: 'Sell at EMA20' }]);
    if (price > ema20) {
      st.cooldown = ctx.i + 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{
    side: 'buy',
    price: lower,
    trigger: 'below',
    note: 'Buy Keltner lower band',
    conds: [
      { label: 'Price > SMA200', now: price, op: '>', ref: sma200 },
      { label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'Fed gate OK', ok: fedGate },
      ...(st.cooldown != null && ctx.i < st.cooldown ? [{ label: 'Cooldown done', ok: ctx.i >= st.cooldown }] : []),
    ],
  }]);

  if (st.cooldown != null && ctx.i < st.cooldown) return null;

  if (price > sma200 && price <= lower && rsi < 40 && fedGate) {
    st.cooldown = null;
    const riskEq = 0.015 * ctx.cash;
    const qty = riskEq / atr;
    const maxQty = ctx.cash / price * 0.9;
    return { side: 'buy', qty: Math.min(qty, maxQty) };
  }
  return null;
}
