/*
 * @coinsori-strategy v1
 * name: BtcOversoldReversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sharp daily sell-offs in Bitcoin often overshoot fair value and
 * then bounce. Buying when price is stretched far below its recent average (lower
 * Bollinger band) AND momentum is oversold (RSI < 30) targets those bounces.
 * When it buys and sells: Buys when close is below the lower Bollinger band (20,2)
 * and RSI(14) < 30 (both closed bars). Sells when close reaches the middle band
 * (SMA20) or on a stop at 1.5x ATR(14) below entry.
 * When it does NOT work: in a strong downtrend the bounce never comes and the dip
 * keeps going — the ATR stop limits each loss but a persistent bear market grinds it
 * down with repeated small losses. Flat chop just below the band gives whipsaws.
 */

function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1); // closed-bar Bollinger
  const rsi = ctx.rsi(14, 1); // closed-bar RSI
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const lower = bb.lower;
  const mid = bb.mid;

  // ATR stop: 1.5x daily ATR below entry — sized to BTC's own volatility, not a guess
  const stop = ctx.entryPx != null ? ctx.entryPx - 1.5 * atr : null;

  ctx.watch([
    { side:'buy', price: lower, trigger:'below', note:'BB lower touch',
      conds:[{ label:'RSI(14) < 30', now: rsi, op:'<', ref:30, closed:true }] },
    { side:'sell', price: mid, trigger:'above', note:'mean reversion target' },
    { side:'sell', price: stop, trigger:'below', note:'ATR stop' }
  ]);

  if (pos === 0) {
    if (price <= lower && rsi < 30) {
      return { side:'buy', qty: ctx.cash / price * 0.99 };
    }
    return null;
  }

  if (stop != null && price <= stop) return { side:'sell', qty: pos };
  if (price >= mid) return { side:'sell', qty: pos };
  return null;
}
