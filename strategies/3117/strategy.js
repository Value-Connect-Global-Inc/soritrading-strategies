/*
 * @coinsori-strategy v1
 * name: ADA Keltner MR 4H Trend-Gated
 * ex: binance
 * syms: ADAUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: ATR-adaptive Keltner mean-reversion was validated positive on ADA
 * 4h across 3 disjoint windows (all beat buy-and-hold). A 200-SMA trend gate was then
 * added to halve the drawdown (22-40% down to 9-21%) by only buying pullbacks in an uptrend.
 * When it buys and sells: buys when price closes below EMA20 minus 2.5x ATR with RSI(14)<40
 * AND price above the 200-SMA (uptrend only); sells when price recovers above the 20-EMA.
 * 2-bar cooldown cuts whipsaw.
 * When it does NOT work: in a straight-line melt-up it sits in cash and lags buy-and-hold;
 * the 200-SMA gate keeps it out of strong bear rallies, so it can miss the bottom-fishing
 * bounce in a crash. Defensive pullback strategy, not a chaser.
 * 2026-04-27 표시만 바뀜, 매매 판단은 그대로.
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
  if (ema20 == null || atr == null || atr <= 0 || rsi == null || sma200 == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  if (pos > 0) {
    // Exit once price recovers above the 20-EMA (channel mid). No hard stop:
    // the mid-band exit is what makes this recipe work (a hard stop whipsaws on 4h).
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'above', qty: pos, note: 'EMA20 exit', conds: [{ label: 'cooldown ready', ok: cd === 0 }] }]);
    if (price > ema20 && cd === 0) {
      st.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const keltnerLow = ema20 - 2.5 * atr; // 2.5 ATR below EMA20 = volatility-adaptive lower band
  // 200-SMA trend gate: only buy pullbacks in an uptrend, to avoid bear-market knives
  ctx.watch([{
    side: 'buy',
    price: keltnerLow,
    trigger: 'below',
    qty: (ctx.cash / price) * 0.95,
    note: 'Keltner MR entry',
    conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'price > SMA200', now: price, op: '>', ref: sma200 },
      { label: 'cooldown ready', ok: cd === 0 }
    ]
  }]);
  if (price < keltnerLow && rsi < 40 && price > sma200 && cd === 0) {
    st.cd = 2;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
