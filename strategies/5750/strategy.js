/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Usage Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Instead of reading price momentum, it reads network
 * adoption via smoothed daily active Bitcoin addresses (addr_sma30). Rising
 * usage = real demand behind the price; falling usage = hype without
 * fundamentals. This is a completely different signal family (on-chain) than
 * the price-only champion, so it risks catching moves the channel misses.
 * When it buys and sells: Buys when smoothed active addresses start rising
 * again AND price is above its 200-day average (so we only follow usage up in
 * an established bull). Sells when smoothed addresses start falling, or
 * immediately if price drops 25% below entry (disaster stop).
 * When it does NOT work: Addresses are a slow, noisy series — in a choppy
 * range it whipsaws on every small usage wiggle. It lags price badly at
 * turning points because usage confirms a move only after price has made it.
 * It can also stay flat through a strong rally if usage is flat (e.g. ETFs
 * absorbing supply without on-chain activity).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr_sma30');
  if (addr == null) return null;

  const closes = ctx.closes;
  const atr20 = ctx.atr(20, 1);
  if (atr20 == null || closes.length < 210) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // remember yesterday's smoothed address count to detect the turn (restart-safe)
  const st = ctx.state || {};
  const prevAddr = st.prevAddr;
  st.prevAddr = addr;
  ctx.state = st;

  const pos = ctx.position;
  const entryPx = ctx.entryPx;

  if (pos > 0) {
    const disaster = (entryPx != null) ? entryPx * 0.75 : null; // 25% below entry
    const watch = [];
    if (disaster != null) watch.push({ side: 'sell', price: disaster, trigger: 'below', note: '25% disaster stop' });
    if (watch.length > 0) ctx.watch(watch);
    if (prevAddr != null && addr < prevAddr) {
      return { side: 'sell', qty: pos, reduceOnly: true }; // usage rolling over = exit
    }
    if (disaster != null && price <= disaster) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  if (ctx.alloc && ctx.alloc.status !== 'ok') return null;

  if (prevAddr != null && addr > prevAddr && prevClose > sma200) {
    const atrPct = atr20 / price;
    const frac = Math.min(1, 0.03 / atrPct); // vol-target: 3% daily ATR = full position
    const qty = (0.99 * ctx.cash * frac) / price * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
