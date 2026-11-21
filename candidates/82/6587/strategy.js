/*
 * @coinsori-strategy v1
 * name: BTC 4H Dip MR Regime BB
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Mean reversion in an uptrend: buy short-term dips and sell the bounce.
 * Buys when price dips below the lower Bollinger band with RSI below 45 while
 * price is above the 200-bar average; sells when price climbs back above the
 * middle band, or stops out 2.5x ATR below entry.
 * Loses when a dip keeps falling through the stop (a real reversal, not a
 * pullback) and does nothing in bear markets (no short side).
 */

function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  const atr = ctx.atr(14, 1);
  if (sma200 == null || bb == null || rsi == null || atr == null) return null;

  const price = ctx.price;
  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  const inBull = price > sma200; // regime: only buy dips above the 200-bar average
  const oversold = rsi < 45; // dip confirmed by weak momentum
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';

  if (pos === 0) {
    const belowLower = price < bb.lower;
    ctx.watch([{
      side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch',
      conds: [{ label: 'RSI14', now: rsi, op: '<', ref: 45, closed: true },
              { label: 'SMA200 bull', ok: inBull, closed: true }]
    }]);
    if (inBull && allocOk && oversold && belowLower) {
      ctx.state.slPx = null;
      return { side: 'buy', qty: (ctx.cash * 0.98) / price };
    }
    return null;
  }

  let sl = null;
  if (entry != null) sl = entry - 2.5 * atr; // hard stop: a real reversal, not a pullback
  ctx.state.slPx = sl;
  const watch = [{ side: 'sell', price: bb.mid, trigger: 'above', note: 'back to mid' }];
  if (sl != null) watch.push({ side: 'sell', price: sl, trigger: 'below', note: 'stop loss' });
  ctx.watch(watch);

  if (price > bb.mid || (sl != null && price <= sl)) {
    ctx.state.slPx = null;
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
