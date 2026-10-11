/*
 * @coinsori-strategy v1
 * name: BNB Donchian Breakout 4h
 * ex: binance
 * syms: BNBUSDT
 * interval: 4h
 * cash: 10000
 * 2026-05-07 표시만 바뀜, 매매 판단은 그대로
 *
 * Why this strategy: In strong trends, price that breaks above the highest high of the
 * last 20 bars tends to keep running (momentum continuation / volatility expansion).
 * When it breaks below the last 10-bar low, the trend is over.
 * When it buys and sells: Buys when price closes above the 20-bar high while price is
 * above the 100-bar average (only trades in an uptrend). Sells when price closes below
 * the 10-bar low. Position size is scaled so a 2xATR adverse move costs about 2% of cash.
 * When it does NOT work: In long sideways / choppy markets where breakouts fail and
 * whip the position back and forth repeatedly. Also loses when a breakout is a short
 * head-fake in the last phase of a bear rally.
 */
function onUpdate(ctx) {
  const entryN = 20;  // breakout lookback: 4h x 20 = ~3.3 days of range
  const exitN = 10;   // exit lookback: tighter, so we leave a broken trend fast
  const trendN = 100; // uptrend gate: 4h x 100 = ~2.5 weeks of mean

  // all reads use closed bars (ago>=1) except the live price itself
  const ch = ctx.high(entryN, 1); // highest high of last 20 CLOSED bars
  const cl = ctx.low(exitN, 1);   // lowest low of last 10 CLOSED bars
  const sma = ctx.sma(trendN, 1);
  const atr = ctx.atr(14, 1);
  const px = ctx.price;
  if (ch == null || cl == null || sma == null || atr == null || px == null) return null;

  if (ctx.position <= 0) {
    // flat: only chase breakouts inside an uptrend to skip bear-market fakes
    ctx.watch([
      {
        side: 'buy',
        price: ch,
        trigger: 'above',
        note: '20-bar high breakout',
        conds: [
          { label: 'close > SMA100', now: px, op: '>', ref: sma }
        ]
      }
    ]);

    if (px > ch && px > sma) {
      const riskCash = ctx.cash * 0.02;   // risk 2% of equity per trade
      const qty = riskCash / (2 * atr);   // 2xATR adverse move = that 2%
      if (qty > 0) return { side: 'buy', qty };
    }
    return null;
  }

  // in position: a close below the 10-bar low ends the trend, take the exit
  ctx.watch([
    { side: 'sell', price: cl, trigger: 'below', note: '10-bar low exit' }
  ]);

  if (px < cl) {
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
