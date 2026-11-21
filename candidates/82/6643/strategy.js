/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Usage Regime 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily active addresses measure real network usage, an information
 * source that is independent of price. Usage expands through bull markets and collapses in bears,
 * so it can act as a regime filter that buying-and-holding does not have.
 * When it buys and sells: hold BTC while active addresses stay above their 30-day average
 * (adopters coming in = bull regime). Sell to cash when usage falls below its 30-day average,
 * and always on a hard -20% stop.
 * When it does NOT work: active addresses can peak before price (they topped before the 2021 price
 * top), so the strategy may exit early and miss the final leg of a rally. In flat sideways markets
 * the daily usage signal whipsaws and pays fees.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const addr = ctx.data('addr');        // daily unique active addresses (count)
  const addr30 = ctx.data('addr_sma30'); // 30-day average of active addresses
  if (addr == null || addr30 == null) return null;

  const pos = ctx.position || 0;
  const entry = ctx.entryPx;

  if (pos > 0) {
    // Hard stop first: a -20% stop cuts crashes that on-chain usage only confirms days later.
    if (entry != null && price <= entry * 0.80) {
      ctx.watch([{ side:'sell', price: entry * 0.80, trigger:'below', note:'hard stop -20%' }]);
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    // Regime exit: active addresses below their 30-day average = network usage contracting.
    if (addr < addr30) {
      ctx.watch([{ side:'sell', price: price, trigger:'below', note:'usage contracting',
        conds:[{ label:'addr below 30d avg', ok: addr < addr30 }] }]);
      return { side:'sell', qty: pos, reduceOnly: true };
    }
    // Holding: declare the stop we are waiting for every tick.
    ctx.watch([{ side:'sell', price: entry * 0.80, trigger:'below', note:'hard stop -20%' }]);
    return null;
  }

  // Entry: active addresses above their 30-day average = network usage expanding.
  if (addr > addr30) {
    ctx.watch([{ side:'buy', price: price, trigger:'above', note:'usage expanding',
      conds:[{ label:'addr above 30d avg', ok: addr > addr30 }] }]);
    return { side:'buy', qty: ctx.cash / price * 0.99 };
  }

  ctx.watch([]);
  return null;
}
