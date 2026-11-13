/*
 * @coinsori-strategy v1
 * name: ETH Trend-Filtered Mean Reversion 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In an uptrend, sharp 4h pullbacks to the lower Bollinger band tend to revert to the middle band. We only buy dips when the longer trend is still up (price above the 100-SMA), so we are not catching falling knives in downtrends, and we size by a fixed dollar risk with an ATR stop so no single dip can hurt the account.
 * When it buys and sells: Long when price closes at/below the lower Bollinger band while the 100-SMA trend is up; sell when price reverts to the middle band or hits a 2*ATR stop-loss.
 * When it does NOT work: In a strong one-way rally price rides the upper band and rarely dips, so few trades and it lags buy-and-hold; in a chop that turns into a slow grind lower, the 100-SMA filter is late and the strategy buys falling knives until the filter flips.
 */

function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const rsi = ctx.rsi(14, 1);
  const bb = ctx.bb(20, 2, 1);
  const smaLong = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  const closePrev = ctx.closes.at(-2);
  const price = ctx.price;

  if (rsi == null || bb == null || smaLong == null || atr == null || closePrev == null) {
    ctx.watch([]);
    return null;
  }

  // trend filter: only buy dips while price is above the 100-SMA (uptrend intact)
  const trendUp = closePrev > smaLong;
  // dip signal: yesterday's close at/below the lower Bollinger band
  const dip = closePrev <= bb.lower;
  // oversold confirmation (kept loose so we still get trades)
  const oversold = rsi < 45;

  const entryPx = ctx.entryPx;
  // stop level: 2*ATR below entry (current ATR; widens with volatility)
  const stopPx = entryPx != null ? entryPx - 2 * atr : null;

  ctx.watch([
    { side:'buy', price: bb.lower, trigger:'below', note:'Dip to BB lower', conds:[ { label:'Trend up (close>SMA100)', ok:trendUp }, { label:'RSI(14) close', now:rsi, op:'<', ref:45, closed:true } ] },
    { side:'sell', price: bb.mid, trigger:'above', note:'Revert to mid band' },
    { side:'sell', price: stopPx, trigger:'below', note:'2*ATR stop' }
  ]);

  if (pos <= 0) {
    if (trendUp && dip && oversold) {
      if (atr <= 0) return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
      // risk $400 per trade (4% of 10k), stop is 2*ATR away
      const riskQty = 400 / (2 * atr);
      const maxQty = (ctx.cash / price) * 0.98;
      return { side: 'buy', qty: Math.min(riskQty, maxQty) };
    }
    return null;
  }

  if (pos > 0) {
    // exit: revert to middle band, or stop-loss hit
    if (closePrev >= bb.mid) return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    if (stopPx != null && closePrev <= stopPx) return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    return null;
  }
  return null;
}
