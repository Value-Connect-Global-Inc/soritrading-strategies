/*
 * @coinsori-strategy v1
 * name: BTC Network-Adoption Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the number of active Bitcoin addresses is a measure of
 *   real network usage. When usage expands (addresses above their 30-day
 *   average) while price is already in a long uptrend, new adopters are
 *   arriving — historically the fuel for sustained up-legs. This bets on
 *   network adoption driving price, not on price patterns alone.
 * When it buys and sells: buy when active addresses are above their 30-day
 *   average AND price is above its 200-day average. Sell on a 3x ATR chandelier
 *   trailing stop below the highest close since entry, a 20% floor stop, or a
 *   close back below the 200-day average — whichever is hit first. Full
 *   position size (99% of cash).
 * When it does NOT work: it is slow — it only enters after both conditions
 *   are met, so it misses the early, sharpest part of a rally. In a year where
 *   price trends up without new network users, it stays in cash. A 20% market
 *   shock on entry triggers the floor stop and locks in a loss.
 */
function onUpdate(ctx) {
  const addrRaw = ctx.data('addr');
  const avgRaw = ctx.data('addr_sma30');
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  if (addrRaw == null || avgRaw == null || sma200 == null || atr == null) return null;
  const addr = Number(addrRaw);
  const avg = Number(avgRaw);
  if (!isFinite(addr) || !isFinite(avg)) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    // chandelier trail: ratchet to the highest close since entry minus 3x ATR,
    // so a winner keeps its gains instead of giving back a whole crash.
    let hh = ctx.state.hhSinceEntry;
    if (hh == null || prevClose > hh) { hh = prevClose; ctx.state.hhSinceEntry = hh; }
    const trail = hh - 3 * atr;
    const floor = ctx.entryPx != null ? ctx.entryPx * 0.8 : 0;
    const stop = Math.max(trail, floor, sma200);
    if (prevClose < stop) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trail / 200d / 20% floor' }]);
    return null;
  }
  ctx.state.hhSinceEntry = null;

  // network usage must be expanding; price must already be in a long uptrend.
  if (addr <= avg) return null;
  if (prevClose <= sma200) return null;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'adoption + uptrend',
               conds: [{ label: 'addr > 30d avg', ok: addr > avg }] }]);
  return { side: 'buy', qty: (ctx.cash * 0.99) / ctx.price };
}
