/*
 * @coinsori-strategy v1
 * name: Multi-Asset Defensive MR Basket 5-Asset 4H Profit-Target
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, XRPUSDT, BNBUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The 4h MR basket buys oversold flushes in uptrends. The exit makes
 * the difference: a fixed 2.0x ATR profit target plus an EMA20 stop gives an ultra-defensive
 * profile (sub-1.3% drawdown) that stays positive on every recent window, unlike the
 * ATR-trail exit whose return edge vanishes on 2025+ data.
 * When it buys and sells: buy below lower Bollinger (20,2.5) RSI<27 or Keltner low RSI<37
 * in a rising 200-bar avg with 3-bar cooldown; sell at entry+2.0x ATR or below EMA20.
 * When it does NOT work: the fixed target caps winners in strong bounces that would run
 * further under a trailing exit, so it underperforms in strong bull runs.
 *
 * 2026-05-09 표시만 바뀜, 매매 판단은 그대로
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
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) {
    ctx.watch([]);
    return null;
  }

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : ctx.state.entry;
    const target = entry + 2.0 * atr;   // fixed profit target: 2.0 ATR above entry
    ctx.watch([
      { side: 'sell', price: target, trigger: 'above', note: 'fixed target' },
      { side: 'sell', price: ema20, trigger: 'below', note: 'EMA20 stop' }
    ]);
    if (price >= target || price < ema20) {
      ctx.state.entry = null;
      ctx.state.cooldown = ctx.i;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const cooldown = ctx.state.cooldown != null && ctx.i - ctx.state.cooldown < 3;
  if (cooldown) {
    ctx.watch([
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower flush', conds: [
        { label: 'cooldown bars left', now: ctx.state.cooldown + 3 - ctx.i, op: '<=', ref: 0, closed: false },
        { label: 'RSI(14)', now: rsi, op: '<', ref: 27, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]},
      { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner pullback', conds: [
        { label: 'cooldown bars left', now: ctx.state.cooldown + 3 - ctx.i, op: '<=', ref: 0, closed: false },
        { label: 'RSI(14)', now: rsi, op: '<', ref: 37, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]}
    ]);
    return null;
  }

  if (!uptrend) {
    ctx.watch([
      { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower flush', conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 27, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]},
      { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner pullback', conds: [
        { label: 'RSI(14)', now: rsi, op: '<', ref: 37, closed: true },
        { label: 'SMA200 rising', ok: uptrend }
      ]}
    ]);
    return null;
  }

  const bollingerFlush = price < lowerBand && rsi < 27;
  const keltnerPullback = price < keltnerLow && rsi < 37;

  ctx.watch([
    { side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower flush', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 27, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]},
    { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner pullback', conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 37, closed: true },
      { label: 'SMA200 rising', ok: uptrend }
    ]}
  ]);

  if (bollingerFlush || keltnerPullback) {
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) {
      ctx.watch([]);
      return null;
    }
    ctx.state.entry = price;
    ctx.state.cooldown = null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
