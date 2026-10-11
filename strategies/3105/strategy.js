/*
 * @coinsori-strategy v1
 * name: Keltner MR Trend-Gated 4H
 * ex: binance
 * syms: SOLUSDT, XRPUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The base Keltner mean-reversion is positive on all 10 disjoint
 * SOL/XRP 4h windows but carries 22-49% drawdown because it buys pullbacks even in
 * downtrends. Adding a rising 200-bar SMA gate (the defensive filter that made the
 * Bollinger champion work) should cut drawdown by keeping it out of falling markets.
 * When it buys and sells: buys only when price closes below the lower Keltner band
 * (EMA20 - 2.5x ATR) with RSI<40 AND the 200-bar SMA is rising; exits when price closes
 * back above the 20-EMA. 2-bar cooldown cuts whipsaw.
 * When it does NOT work: in a broad bear all rising-trend gates stay flat (capital safe
 * but little upside); it still lags a straight-line melt-up of one asset.
 *
 * 2026-04-26 표시만 바뀜, 매매 판단은 그대로
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (ema20 == null || atr == null || atr <= 0 || rsi == null || sma200 == null || sma200prev == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'above', note: 'exit EMA20', conds: [{ label: 'cooldown', now: cd, op: '<=', ref: 0 }] }]);
    if (price > ema20 && cd === 0) {
      ctx.state.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const uptrend = sma200 > sma200prev; // only buy in a confirmed rising 200-bar regime
  if (!uptrend) {
    ctx.watch([]);
    return null;
  }

  const keltnerLow = ema20 - 2.5 * atr;
  ctx.watch([{ side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low', conds: [{ label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true }, { label: 'cooldown', now: cd, op: '<=', ref: 0 }] }]);
  if (price < keltnerLow && rsi < 40 && cd === 0) {
    ctx.state.cd = 2;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
