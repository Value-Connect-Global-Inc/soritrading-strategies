/*
 * @coinsori-strategy v1
 * name: BtcOversoldReversion
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sharp daily sell-offs inside a Bitcoin uptrend often overshoot and
 * bounce. Buying when close is below the lower Bollinger band (20,2) with RSI(14) < 30
 * catches those bounces — but ONLY when price is above its 200-day average, because
 * oversold in a downtrend keeps falling (falling knife).
 * When it buys and sells: Buys when close is below the lower Bollinger band (20,2),
 * RSI(14) < 30, and price is above its 200-day average (all closed bars). Sells when
 * close reaches the middle band (SMA20) or on a stop at 2x ATR(14) below entry.
 * When it does NOT work: in a bear market it stands aside (below SMA200), so it misses
 * bear-market rallies and just holds cash. In a long sideways range below the 200MA it
 * rarely trades. It can still lose on the ATR stop when a dip inside an uptrend keeps
 * falling through it.
 */

function onUpdate(ctx) {
  const bb = ctx.bb(20, 2, 1); // closed-bar Bollinger
  const rsi = ctx.rsi(14, 1); // closed-bar RSI
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (bb == null || rsi == null || atr == null || sma200 == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const lower = bb.lower;
  const mid = bb.mid;

  // ATR stop: 2x daily ATR below entry — sized to BTC's own volatility, not a guess
  const stop = ctx.entryPx != null ? ctx.entryPx - 2 * atr : null;

  ctx.watch([
    { side:'buy', price: lower, trigger:'below', note:'BB lower touch',
      conds:[ { label:'RSI(14) < 30', now: rsi, op:'<', ref:30, closed:true },
              { label:'price > SMA200', ok: price > sma200 } ] },
    { side:'sell', price: mid, trigger:'above', note:'mean reversion target' },
    { side:'sell', price: stop, trigger:'below', note:'ATR stop' }
  ]);

  if (pos === 0) {
    if (price <= lower && rsi < 30 && price > sma200) {
      return { side:'buy', qty: ctx.cash / price * 0.99 };
    }
    return null;
  }

  if (stop != null && price <= stop) return { side:'sell', qty: pos };
  if (price >= mid) return { side:'sell', qty: pos };
  return null;
}
