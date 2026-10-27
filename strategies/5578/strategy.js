/*
 * @coinsori-strategy v1
 * name: BTC Kimchi-Premium Mean-Revert 1D
 * ex: upbit
 * syms: BTC/KRW
 * interval: 1d
 * cash: 10000000
 *
 * Why this strategy: Korean exchanges sometimes trade BTC at a discount to the
 * global price (negative "kimchi premium"). That discount usually snaps back
 * within days. We buy the cheap KRW BTC and sell when the discount closes.
 * When it buys and sells: Buy when the KRW price is at least 2% cheaper than
 * the fair value (global USD price x USD/KRW). Sell when the discount narrows
 * to +0.5% or a 2.5x ATR stop hits.
 * When it does NOT work: A persistent discount regime (capital controls, no
 * arbitrage flow) can hold the position underwater for months. Also flat,
 * gap-less markets give few signals.
 */
function onUpdate(ctx) {
  const closes = ctx.closes;
  if (closes == null || closes.length < 40) return null;
  const price = ctx.price;
  const pos = ctx.position;
  if (price == null || price <= 0) return null;

  // Global reference: binance BTC/USDT price and real USD/KRW rate.
  const usd = ctx.ref(0);
  const fx = ctx.fx("KRW");
  if (usd == null || fx == null || usd <= 0 || fx <= 0) return null;

  const fair = usd * fx; // what KRW price should be if no premium
  if (fair <= 0) return null;
  const premium = price / fair - 1; // + = expensive in Korea, - = cheap

  const atr = ctx.atr(14, 1);

  if (pos != null && pos > 0) {
    // Exit when discount closes or stop hit.
    const exitPremium = premium >= 0.005;
    let st = ctx.state || {};
    if (typeof st.hi !== 'number') st.hi = ctx.closes.at(-2);
    const pc = ctx.closes.at(-2);
    if (pc > st.hi) st.hi = pc;
    ctx.state = st;
    const stop = atr != null && atr > 0 ? st.hi - 2.5 * atr : null;
    if (exitPremium || (stop != null && price < stop)) {
      ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'stop 2.5xATR' },
                 { side: 'sell', note: 'discount closed' }]);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Entry: deep Korean discount on a closed bar.
  const premPrev = ctx.closes.at(-2) / fair - 1;
  if (premPrev <= -0.02) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state = { hi: ctx.closes.at(-2) };
    const qty = (ctx.cash / price) * 0.99;
    if (qty <= 0) return null;
    ctx.watch([{ side: 'buy', note: 'kimchi discount <= -2%' }]);
    return { side: 'buy', qty: qty };
  }
  return null;
}
