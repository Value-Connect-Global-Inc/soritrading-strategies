/*
 * @coinsori-strategy v1
 * name: Keltner Mean-Reversion BTC-SOL 4H
 * ex: binance
 * syms: BTCUSDT, SOLUSDT
 * interval: 4h
 * cash: 10000
 * 2026-04-26: 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: A genuinely different indicator family from the Bollinger champion —
 * an ATR-adaptive Keltner channel. The lower band is EMA20 minus 2.5x ATR, so it widens
 * and narrows with true volatility instead of a fixed standard deviation. The ledger
 * validated this exact recipe positive 4/4 windows on ETH 4h; this test checks whether it
 * generalizes to BTC and SOL (the ledger explicitly required a second-asset check).
 * When it buys and sells: buys when price closes below the lower Keltner band with RSI<40
 * (a real pullback, not a knife); exits when price closes back above the 20-day EMA (mid
 * of the channel). A 2-bar cooldown after any trade cuts whipsaw.
 * When it does NOT work: in a straight-line melt-up it stays parked in cash and lags
 * buy-and-hold; in a violent bear the RSI<40 filter is too loose and it can buy falling
 * knives. It is a defensive pullback strategy, not a momentum chaser.
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
  if (ema20 == null || atr == null || atr <= 0 || rsi == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    // Exit once price recovers back above the 20-EMA (channel mid). No hard stop:
    // the mid-band exit is what makes this recipe work (a hard stop whipsaws on 4h).
    ctx.watch([{
      side: 'sell',
      price: ema20,
      trigger: 'above',
      note: 'EMA20 mid exit',
      conds: [{ label: 'cooldown', ok: cd === 0 }]
    }]);
    if (price > ema20 && cd === 0) {
      ctx.state.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const keltnerLow = ema20 - 2.5 * atr; // 2.5 ATR below EMA20 = volatility-adaptive lower band
  ctx.watch([{
    side: 'buy',
    price: keltnerLow,
    trigger: 'below',
    note: 'Keltner lower',
    conds: [
      { label: 'RSI(14)', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'cooldown', ok: cd === 0 }
    ]
  }]);
  if (price < keltnerLow && rsi < 40 && cd === 0) {
    ctx.state.cd = 2;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
