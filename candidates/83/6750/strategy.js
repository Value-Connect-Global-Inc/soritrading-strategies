/*
 * @coinsori-strategy v1
 * name: ETH BB Pullback Regime 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: In a clear uptrend, price often pulls back to the lower
 * Bollinger Band and then resumes the trend. Buying those dips and selling
 * back at the middle band turns the pullback into profit.
 * When it buys and sells: Only while price is above a rising 200-bar EMA
 * (bull regime) it buys when the close crosses below the lower Bollinger
 * Band. It sells when the close recovers above the middle band, when the
 * bull regime breaks (close below the 200 EMA), or at a hard ATR stop.
 * When it does NOT work: In sideways chop the EMA filter flips and the dips
 * keep falling, giving repeated small losses. In a long bear market it sits
 * in cash most of the time, so it misses the eventual bottom.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const cash = ctx.cash;
  const pos = ctx.position;
  const entry = ctx.entryPx;

  const ema200 = ctx.ema(200, 1);
  const ema200p = ctx.ema(200, 60);
  const bb = ctx.bb(20, 2, 1);
  const bbPrev = ctx.bb(20, 2, 2);
  const atr = ctx.atr(14, 1);
  if (ema200 == null || ema200p == null || bb == null || bb.lower == null || bb.mid == null ||
      bbPrev == null || bbPrev.lower == null || atr == null) return null;
  if (ctx.closes.length < 3) return null;

  const close1 = ctx.closes.at(-2); // last closed bar
  const close2 = ctx.closes.at(-3); // closed bar before that
  const bull = close1 > ema200 && ema200 > ema200p; // bull regime: above a rising 200 EMA

  const stop = (pos > 0 && entry != null) ? entry - 2.5 * atr : null; // hard stop ~2.5x daily ATR

  // Declare every price we are waiting for
  const watch = [];
  if (pos === 0) {
    if (bull) watch.push({ side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower dip' });
  } else {
    watch.push({ side: 'sell', price: bb.mid, trigger: 'above', note: 'BB mid target' });
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' });
    watch.push({ side: 'sell', price: ema200, trigger: 'below', note: 'regime break' });
  }
  ctx.watch(watch);

  // Exits first
  if (pos > 0) {
    if (close1 < ema200) return { side: 'sell', qty: pos, reduceOnly: true }; // regime broke
    if (stop != null && price <= stop) return { side: 'sell', qty: pos, reduceOnly: true };
    if (close1 > bb.mid) return { side: 'sell', qty: pos, reduceOnly: true }; // mean reversion done
    return null;
  }

  // Entry: fresh cross below the lower band, only in a bull regime
  if (!bull) return null;
  if (close1 < bb.lower && close2 >= bbPrev.lower) {
    return { side: 'buy', qty: (cash * 0.99) / price };
  }
  return null;
}
