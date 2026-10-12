/*
 * @coinsori-strategy v1
 * name: BTPullbackRide
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in a bull market, BTC's sharp pullbacks are buying
 * opportunities — the trend resumes after each dip. Buying the dip (mild
 * oversold) only while price is above its 200-day average avoids the 2022-style
 * bear, where every dip is a trap. This is the opposite family of the breakout
 * champion, which gets whipsawed by exactly these pullbacks.
 * When it buys and sells: buys when price is above the 200-day average and RSI
 * has pulled back below 45; sells when RSI(14) closes above 65 or price hits a
 * 2x ATR hard stop below entry.
 * When it does NOT work: in a strong downtrend the 200-day filter keeps it out
 * (good), but if a bull market turns into a sustained bear it will take a few
 * stop losses on the way down before the filter turns; in a flat market it
 * trades little and makes little. It never shorts, so it cannot profit from a
 * falling market.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const pos = ctx.position;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;
  const rsi = ctx.rsi(14, 1);
  if (rsi == null) return null;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit on overbought (RSI>65) or the hard stop. RSI>65 = the dip has fully
    // recovered into strength; take the profit rather than give it back.
    if (price <= hardStop || rsi > 65) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  if (price <= sma200) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'back above 200d' }]);
    return null;
  }

  if (rsi < 45) {
    // Mild pullback inside an uptrend — buy the dip, not the crash. RSI<45
    // means a shallow retrace, not a crash (which RSI<30 would signal).
    const qty = (ctx.cash / price) * 0.95;
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'below', note: 'pullback toward 200d',
               conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 45, closed: true }] }]);
  return null;
}
