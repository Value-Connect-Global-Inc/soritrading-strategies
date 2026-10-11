/*
 * @coinsori-strategy v1
 * name: ADA Keltner MR 4H Trend-Gated
 * ex: binance
 * syms: ADAUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The ATR-adaptive Keltner mean-reversion recipe was validated
 * positive on ADA 4h across 3 windows, but its drawdown (22-40%) is high because it
 * buys pullbacks even in bear markets. This version adds a 200-SMA trend gate so it
 * only buys dips when price is above the long-term uptrend — cutting bear-market knives.
 * When it buys and sells: buys when price closes below EMA20 minus 2.5x ATR with
 * RSI(14)<40 AND price is above the 200-SMA (uptrend only); sells when price recovers
 * back above the 20-EMA (channel mid). 2-bar cooldown cuts whipsaw.
 * When it does NOT work: in a straight-line melt-up it sits in cash and lags buy-and-hold;
 * the 200-SMA gate keeps it out of strong bear rallies entirely, so it can miss the
 * bottom-fishing bounce in a crash. It is a defensive pullback strategy, not a chaser.
 *
 * 2025-01-05: display-only watch added, trading logic unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (ema20 == null || atr == null || atr <= 0 || rsi == null || sma200 == null) return null;

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  if (pos > 0) {
    // Exit once price recovers above the 20-EMA (channel mid). No hard stop:
    // the mid-band exit is what makes this recipe work (a hard stop whipsaws on 4h).
    ctx.watch([{ side: 'sell', price: ema20, trigger: 'above', note: '20-EMA mid exit' }]);
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
    note: 'Keltner low',
    conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'Close > SMA200', now: price, op: '>', ref: sma200, closed: true }
    ]
  }]);
  if (price < keltnerLow && rsi < 40 && price > sma200 && cd === 0) {
    st.cd = 2;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
