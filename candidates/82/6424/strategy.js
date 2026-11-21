/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Demand Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily unique active addresses (blockchain.com,
 * via the account's on-chain dataset) measure real network usage. Sustained
 * growth in usage (30-day average above its 90-day average) is a demand regime
 * in which BTC tends to trend up; usage contraction flags weakening demand.
 * This bets that price breakouts inside a usage-expansion regime are more
 * likely to continue than breakouts in a usage-contraction regime.
 * When it buys and sells: buys when price closes above its 20-day high while
 * usage is expanding; sells when price closes below its 20-day low, when usage
 * turns to contraction, or on a -25% catastrophe stop.
 * When it does NOT work: in long sideways chop with usage flat it whipsaws on
 * repeated 20-day breakouts; a slow grind higher with falling usage (usage
 * lags price) keeps it out of part of a bull run, so buy-and-hold can beat it.
 */
function onUpdate(ctx) {
  const addr = ctx.data('addr');            // daily unique active addresses (on-chain usage)
  if (addr == null) return null;            // data not available — do nothing

  const st = ctx.state;
  let hist = st.addrHist || [];
  // hist holds usage values up to the PREVIOUS (closed) bar — no look-ahead.
  let expansion = null;
  if (hist.length >= 90) {
    let s30 = 0, s90 = 0;
    for (let i = hist.length - 30; i < hist.length; i++) s30 += hist[i];
    for (let i = hist.length - 90; i < hist.length; i++) s90 += hist[i];
    expansion = (s30 / 30) > (s90 / 90);    // short-term usage above long-run usage = demand growing
  }
  hist.push(addr);
  if (hist.length > 150) hist = hist.slice(-150);
  st.addrHist = hist;
  if (expansion == null) return null;       // warm-up: need 90 days of usage history

  const price = ctx.price;
  const pos = ctx.position || 0;

  // Donchian levels from CLOSED bars only (ago>=1) so live == backtest.
  let hi20 = -Infinity, lo20 = Infinity;
  for (let i = 2; i <= 21; i++) {
    const h = ctx.highs.at(-i);
    if (h > hi20) hi20 = h;
  }
  for (let i = 2; i <= 21; i++) {
    const l = ctx.lows.at(-i);
    if (l < lo20) lo20 = l;
  }

  if (pos > 0) {
    const entry = ctx.entryPx;
    const hardStop = entry != null ? entry * 0.75 : null;  // -25% catastrophe stop
    const watch = [
      { side: 'sell', price: lo20, trigger: 'below', note: '20d breakdown exit' },
      // regime exit has no price level — re-expressed at current price; the cond decides
      { side: 'sell', price: price, trigger: 'below', note: 'Usage contraction exit', conds: [{ label: 'Addr 30MA<90MA', ok: !expansion }] },
    ];
    if (hardStop != null) watch.push({ side: 'sell', price: hardStop, trigger: 'below', note: 'Hard stop -25%' });
    ctx.watch(watch);
    if (!expansion) return { side: 'sell', qty: pos, reduceOnly: true };
    if (price < lo20) return { side: 'sell', qty: pos, reduceOnly: true };
    if (hardStop != null && price <= hardStop) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  ctx.watch([{ side: 'buy', price: hi20, trigger: 'above', note: '20d breakout', conds: [{ label: 'Usage expanding', ok: expansion }] }]);
  if (expansion && price > hi20) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
