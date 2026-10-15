/*
 * @coinsori-strategy v1
 * name: On-Chain Adoption Trend (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's active-address count is a real network-usage
 * signal, independent of price sentiment. When usage is growing above its own
 * 30-day average at the same time price is above its long-term trend, adoption
 * and price are confirming each other — historically a durable uptrend regime.
 * When it buys and sells: buys when active addresses exceed their 30-day
 * average and the close is above the 200-day SMA. Sells when the close drops
 * below the 200-day SMA (trend broken) or a 20% hard stop is hit.
 * When it does NOT work: in a mature bull market where fees/L2s move activity
 * off-chain, active addresses can stagnate while price keeps rising — the
 * strategy then sits out real gains. In a price spike with no usage growth it
 * stays flat and misses momentum.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // On-chain usage data; null = unknown, stay flat (never assume).
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (addr == null || addrSma == null || addrSma <= 0) return null;

  // Long-term trend on CLOSED bars so backtest/paper/live agree.
  const sma200 = ctx.sma(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (sma200 == null || prevClose == null) return null;

  // Adoption growing: usage above its 30-day average by a small margin.
  // 2% margin avoids buying on noise around the average.
  const adoptionUp = addr > addrSma * 1.02;
  // Price above its 200-day SMA = long-term uptrend intact.
  const trendUp = prevClose > sma200;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.80; // hard stop 20% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (!trendUp) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'exit: < SMA200',
                 conds: [{ label: 'close vs SMA200', ok: trendUp, closed: true }] }]);
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'enter: > SMA200 + adoption',
               conds: [{ label: 'addr vs SMA30', ok: adoptionUp, closed: true }] }]);
  if (!(adoptionUp && trendUp)) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
