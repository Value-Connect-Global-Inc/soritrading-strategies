/*
 * @coinsori-strategy v1
 * name: BTC EMA-Pullback Reversion 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In an uptrend, price pulls back to its 20-bar average and
 * then resumes. We buy the oversold pullback (RSI below 35) only while the
 * 200-bar trend is still up, and sell when price returns to the average. This
 * is a low-drawdown, risk-parity style strategy: small steady gains instead of
 * riding big trends.
 * When it buys and sells: Buy when the last closed bar is at or below the 20-bar
 * EMA, RSI(14) is below 35, and price is above the 200-bar SMA. Sell when the
 * closed bar climbs back above the 20-bar EMA, or on a 3xATR hard stop.
 * When it does NOT work: In a real reversal the "pullback" keeps falling and the
 * stop cuts the loss; in a long flat grind RSI stays mid-range and we rarely
 * trade. It never beats a strong bull market — it is a risk-managed alternative.
 */
function onUpdate(ctx) {
  const ema20 = ctx.ema(20, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (ema20 == null || rsi == null || sma200 == null || atr == null) return null;

  const prevClose = ctx.closes.at(-2);
  const inPos = ctx.position > 0;

  // trend gate: only buy pullbacks while the 200-bar trend is up
  const uptrend = prevClose > sma200;

  // exit 1: price reverted back above its 20-bar EMA
  const reverted = prevClose > ema20;
  // exit 2: hard stop 3x ATR below entry
  const stopPx = ctx.entryPx != null ? ctx.entryPx - 3 * atr : null;

  if (inPos && (reverted || (stopPx != null && ctx.price <= stopPx))) {
    ctx.watch([
      { side:'sell', price: ema20, trigger:'above', note:'reverted to EMA20' },
      { side:'sell', price: stopPx != null ? stopPx : ema20, trigger:'below', note:'3xATR stop' }
    ]);
    return { side:'sell', qty: ctx.position, reduceOnly:true };
  }

  // entry: oversold pullback inside an uptrend
  if (!inPos && uptrend && prevClose <= ema20 && rsi < 35) {
    const stop = prevClose - 3 * atr;
    ctx.watch([
      { side:'buy', price: ema20, trigger:'below', note:'pullback to EMA20' },
      { side:'sell', price: stop, trigger:'below', note:'3xATR stop' }
    ]);
    return { side:'buy', qty: ctx.cash / ctx.price * 0.99 };
  }

  ctx.watch([]);
  return null;
}
