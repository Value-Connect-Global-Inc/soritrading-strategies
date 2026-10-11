/*
 * @coinsori-strategy v1
 * name: OnChain Adoption Trend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC price follows network adoption with a lag — when the number of active addresses is growing, the network is being used more, and price tends to follow. This uses on-chain data (ctx.data 'addr') as a fundamentally different signal from price momentum.
 * When it buys and sells: Buys when flat AND price is above its 200-day average AND daily active addresses are above their 30-day average (adoption growing). Sells when adoption stops growing (addresses fall back below their 30-day average) or when a hard 3-ATR stop is hit.
 * When it does NOT work: Adoption data is daily and lags price — it never catches a bottom and exits late on tops. In a price rally driven purely by speculation (no new users), the address filter keeps it out. A single bad address-data point can cause a whipsaw exit.
 */
function onUpdate(ctx) {
  const price = ctx.closes.at(-2);
  if (price == null) return null;
  const atr = ctx.atr(14, 1);

  // ---- exit ----
  if (ctx.position > 0) {
    if (atr == null) return null;
    // hard stop: never lose more than 3 ATR from entry (~15-20% on BTC 1d). Protects
    // against the case where price falls before adoption data turns down.
    const stopPx = ctx.entryPx - 3 * atr;
    if (price <= stopPx) return { side: 'sell', qty: ctx.position };
    // adoption trend exit: when active addresses drop below their 30-day average,
    // the fundamental driver is fading — exit even if price still looks high.
    const addr = ctx.data('addr');
    const addrSm = ctx.data('addr_sma30');
    if (addr != null && addrSm != null && addr < addrSm) {
      return { side: 'sell', qty: ctx.position };
    }
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: '3 ATR hard stop' }]);
    return null;
  }

  // ---- entry only when flat ----
  // Price must be in a long-term uptrend (above 200-day average). Avoids buying
  // adoption spikes during bear markets.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null || price < sma200) return null;

  // Adoption growing: current active addresses above their 30-day average.
  // This is the core signal — real network usage, not just price.
  const addr = ctx.data('addr');
  const addrSm = ctx.data('addr_sma30');
  if (addr == null || addrSm == null || addrSm <= 0 || addr <= addrSm) {
    if (addr != null && addrSm != null) ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'Adoption trend', conds: [{ label: 'Addr>30d avg', ok: addr > addrSm }] }]);
    return null;
  }

  return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
}
