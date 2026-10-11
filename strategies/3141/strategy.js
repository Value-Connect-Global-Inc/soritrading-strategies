/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend-Gated Keltner Mean-Reversion
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a confirmed uptrend (price above the 200-period average),
 * sharp drops down to a volatility band are usually overreactions that snap back
 * to the trend mean. This ATR-adaptive Keltner recipe validated on ADA/ETH/SOL/XRP
 * and BTC 4h; this build is the exact validated recipe, verified fresh on three
 * disjoint windows. Two failed variants are documented in the ledger: a hard
 * stop-loss and a one-bar-delayed entry both made results WORSE.
 * When it buys and sells: buys when price touches below the lower Keltner band
 * (20-EMA minus 2.5x ATR) with RSI(14) below 40 AND price above the 200-SMA
 * (uptrend only); sells when price recovers above the 20-EMA. 2-bar cooldown
 * cuts whipsaw.
 * When it does NOT work: in a straight-line melt-up it sits in cash and lags
 * buy-and-hold; the 200-SMA gate keeps it out of bear rallies, so it misses the
 * bottom-fishing bounce in a crash. Defensive pullback strategy, not a chaser.
 *
 * 2026-05-12 표시만 바뀜, 매매 판단은 그대로
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

  const keltnerLow = ema20 - 2.5 * atr; // 2.5 ATR below EMA20 = volatility-adaptive lower band

  if (pos > 0) {
    ctx.watch([
      {
        side: 'sell',
        price: ema20,
        trigger: 'above',
        note: 'snap-back to EMA20',
        conds: [{ label: 'cooldown done', ok: cd === 0 }]
      }
    ]);
    // Exit once price recovers above the 20-EMA (channel mid). No hard stop:
    // the mid-band exit is what makes this recipe work (a hard stop whipsaws on 4h).
    if (price > ema20 && cd === 0) {
      st.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([
    {
      side: 'buy',
      price: keltnerLow,
      trigger: 'below',
      note: 'Keltner lower band',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'price > SMA200', ok: price > sma200 },
        { label: 'cooldown done', ok: cd === 0 }
      ]
    }
  ]);

  // 200-SMA trend gate: only buy pullbacks in an uptrend, to avoid bear-market knives.
  if (price < keltnerLow && rsi < 40 && price > sma200 && cd === 0) {
    st.cd = 2;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
