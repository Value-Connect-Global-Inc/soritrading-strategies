/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend-Gated Keltner MR
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * 2026-04-08: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: The ATR-adaptive Keltner mean-reversion recipe was validated as a
 * robust defensive family on ADA/ETH/SOL/XRP 4h. This applies it to BTC 4h with a 200-SMA
 * trend gate so it only buys pullbacks in an uptrend — cutting bear-market knives and
 * keeping drawdown tolerable on the largest, most liquid crypto.
 * When it buys and sells: buys when price closes below EMA20 minus 2.5x ATR with RSI(14)<40
 * AND price is above the 200-SMA (uptrend only); sells when price recovers above the 20-EMA.
 * 2-bar cooldown cuts whipsaw.
 * When it does NOT work: in a straight-line melt-up it sits in cash and lags buy-and-hold;
 * the 200-SMA gate keeps it out of strong bear rallies, so it can miss the bottom-fishing
 * bounce in a crash. Defensive pullback strategy, not a chaser.
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
    ctx.watch([{
      side: 'sell',
      price: ema20,
      trigger: 'above',
      note: 'exit above EMA20',
      conds: [{ label: 'cooldown', ok: cd === 0 }]
    }]);
    if (price > ema20 && cd === 0) {
      st.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const keltnerLow = ema20 - 2.5 * atr;
  ctx.watch([{
    side: 'buy',
    price: keltnerLow,
    trigger: 'below',
    note: 'buy pullback',
    conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'price > SMA200', now: price, op: '>', ref: sma200 },
      { label: 'cooldown', ok: cd === 0 }
    ]
  }]);
  if (price < keltnerLow && rsi < 40 && price > sma200 && cd === 0) {
    st.cd = 2;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
