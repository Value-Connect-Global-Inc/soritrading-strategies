/*
 * @coinsori-strategy v1
 * name: BTC 4H Long-Only Trend Regime
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why: BTC trends hard; a long-only regime filter rides up-legs and steps
 * aside in down-legs, aiming for buy-and-hold-like return with a much
 * smaller drawdown (no shorts on spot, so it can never be run over).
 * When it buys: price above a rising 100-EMA and above the 20-EMA.
 * When it sells: price falls below the 20-EMA (trailing) or below the
 * 100-EMA (regime out), or a 2.5xATR hard stop hits.
 * When it does NOT work: choppy sideways markets where the EMAs flatten
 * and it gets whipsawed; and it underperforms pure holding in strong
 * straight-up runs because it is out part of the time.
 */
function onUpdate(ctx) {
  const ema100 = ctx.ema(100, 1), ema20 = ctx.ema(20, 1), atr = ctx.atr(14, 1);
  if (ema100 == null || ema20 == null || atr == null) return null;
  const price = ctx.price, pos = ctx.position || 0;
  const ema100Prev = ctx.ema(100, 2);
  const rising = ema100Prev != null && ema100 > ema100Prev;

  const stop = ctx.entryPx == null ? null : ctx.entryPx - 2.5 * atr;
  const watch = [];
  if (pos === 0) {
    // Buy only when regime is up (EMA100 rising) and price is above both EMAs.
    watch.push({ side: 'buy', price: ema20, trigger: 'above', note: 'Price above 20-EMA in up regime', conds: [
      { label: 'EMA100 rising', ok: rising, closed: true },
      { label: 'Price>EMA100', ok: price > ema100, closed: true } ] });
  } else {
    watch.push({ side: 'sell', price: ema20, trigger: 'below', note: 'Trailing 20-EMA exit' });
    watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'Hard stop' });
  }
  ctx.watch(watch);

  if (pos > 0) {
    if (price < ema20 || (stop != null && price < stop)) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }
  if (price > ema20 && price > ema100 && rising) {
    // Risk 2% of equity at a 2.5xATR stop -> small qty, no wipeout possible.
    const riskCash = ctx.cash * 0.02;
    const qty = riskCash / (2.5 * atr);
    return { side: 'buy', qty };
  }
  return null;
}
