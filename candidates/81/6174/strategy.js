/*
 * @coinsori-strategy v1
 * name: BTC 4H BB Mean Reversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: sharp moves to the Bollinger bands on the 4H chart often
 * snap back to the middle band; fading the extremes is a mean-reversion bet.
 * Funding extremes reveal a crowded trade — fading a band into an extreme crowd
 * risks a liquidation cascade, so those entries are skipped.
 * When it buys and sells: buys when price touches the lower band while above the
 * SMA200 (uptrend) and funding is not extreme-long; shorts on the upper band while
 * below the SMA200 (downtrend) and funding is not extreme-short; exits when price
 * returns to the middle band or hits a hard ATR stop.
 * When it does NOT work: strong one-way trends where price hugs a band and keeps
 * going; the hard stop caps the damage but the trend filter cannot filter all.
 */
function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1);
  const atr = ctx.atr(14, 1);
  const trend = ctx.sma(200, 1);
  if (bb == null || atr == null || trend == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const st = ctx.state;
  const stopMult = 2.5; // hard stop 2.5x ATR: caps a failed reversion in a trending move
  const funding = ctx.funding; // current funding rate (decimal); null when unknown
  const crowdThresh = 0.0003; // 3x the exchange's ~0.01% baseline funding = genuinely extreme crowd
  const crowdLong = funding != null && funding > crowdThresh;   // longs pay a lot = crowded long
  const crowdShort = funding != null && funding < -crowdThresh; // shorts pay a lot = crowded short

  if (pos > 0) {
    // restart-safe: seed the stop from entry when state is missing
    if (st.stopLong == null) st.stopLong = (ctx.entryPx != null ? ctx.entryPx : price) - stopMult * atr;
    ctx.watch([
      { side: 'sell', price: st.stopLong, trigger: 'below', note: 'hard stop' },
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'mean target' }
    ]);
    if (price <= st.stopLong || price >= bb.mid) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (pos < 0) {
    if (st.stopShort == null) st.stopShort = (ctx.entryPx != null ? ctx.entryPx : price) + stopMult * atr;
    ctx.watch([
      { side: 'buy', price: st.stopShort, trigger: 'above', note: 'hard stop' },
      { side: 'buy', price: bb.mid, trigger: 'below', note: 'mean target' }
    ]);
    if (price >= st.stopShort || price <= bb.mid) {
      return { side: 'buy', qty: -pos, reduceOnly: true };
    }
    return null;
  }

  // flat: reset stops so a new entry starts from its own entry price
  st.stopLong = null;
  st.stopShort = null;
  ctx.watch([
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'lower band + uptrend', conds: [
      { label: 'price > SMA200', ok: price > trend },
      { label: 'funding not extreme-long', ok: !crowdLong }
    ]},
    { side: 'sell', price: bb.upper, trigger: 'above', note: 'upper band + downtrend', conds: [
      { label: 'price < SMA200', ok: price < trend },
      { label: 'funding not extreme-short', ok: !crowdShort }
    ]}
  ]);
  if (price <= bb.lower && price > trend && !crowdLong) {
    return { side: 'buy', qty: ctx.cash / price * 0.4 };
  }
  if (price >= bb.upper && price < trend && !crowdShort) {
    return { side: 'sell', qty: ctx.cash / price * 0.4 };
  }
  return null;
}
