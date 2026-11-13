/*
 * @coinsori-strategy v1
 * name: BTC 4H Trend + OnChain Usage Gate
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: A different information source than macro rates/vol or funding —
 * on-chain fundamentals. Bitcoin's daily unique active addresses (main.addr) measure
 * real network usage. Rallies backed by growing usage are durable; rallies on shrinking
 * usage are fragile and tend to fail. We keep the validated EMA50/200 trend core and
 * only enter when the trend is up AND network usage is expanding.
 * When it buys and sells: Buy when EMA50 > EMA200, price above EMA50, and the 30-day
 * change of active addresses is positive. Sell when the trend breaks, usage starts
 * contracting sharply (30d change below -10%), or price falls -25% from entry.
 * When it does NOT work: addresses are a slow daily series, so it reacts late to fast
 * price-only moves; and in a price rally where on-chain usage lags or declines (e.g.
 * ETF-led bull without new retail addresses) the gate keeps us out of the whole move.
 */
function onUpdate(ctx) {
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  if (ema50 == null || ema200 == null || prevClose == null) {
    ctx.watch([]);
    return null;
  }
  const addr = ctx.data('main.addr');
  if (addr == null) { ctx.watch([]); return null; }

  // Keep the last ~90 unique daily address values in state (addr updates once a day).
  const hist = ctx.state.addrHist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== addr) {
    hist.push(addr);
    if (hist.length > 90) hist.shift();
    ctx.state.addrHist = hist;
  }
  // 30-day usage change: hist stores unique daily values, so index len-31 is ~30 days ago.
  let addrChg = 0;
  if (hist.length >= 31) {
    const past = hist[hist.length - 31];
    addrChg = past > 0 ? (addr - past) / past : 0;
  }

  const trendUp = ema50 > ema200 && prevClose > ema50;
  const usageUp = addrChg > 0;

  if (ctx.position > 0) {
    const exitBelow = Math.min(ema50, ema200);
    const stop = ctx.entryPx != null ? ctx.entryPx * 0.75 : null;
    ctx.watch([
      { side: 'sell', price: exitBelow, trigger: 'below', note: 'trend broken' },
      { side: 'sell', price: prevClose, trigger: 'below', note: 'usage shrinking', conds: [{ label: '30d addr chg', now: +(addrChg * 100).toFixed(2), op: '<', ref: -10, closed: true }] },
      ...(stop != null ? [{ side: 'sell', price: stop, trigger: 'below', note: 'disaster stop -25%' }] : [])
    ]);
    if (addrChg < -0.10) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (stop != null && prevClose < stop) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    if (prevClose < exitBelow) return { side: 'sell', qty: ctx.position, reduceOnly: true };
    return null;
  }

  if (ctx.alloc != null && ctx.alloc.status !== 'ok') { ctx.watch([]); return null; }

  if (trendUp && usageUp) {
    ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'trend up, usage growing', conds: [{ label: '30d addr chg', now: +(addrChg * 100).toFixed(2), op: '>', ref: 0, closed: true }] }]);
    const qty = (ctx.cash / prevClose) * 0.99;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'waiting trend up + usage growth', conds: [{ label: '30d addr chg', now: +(addrChg * 100).toFixed(2), op: '>', ref: 0, closed: true }] }]);
  return null;
}
