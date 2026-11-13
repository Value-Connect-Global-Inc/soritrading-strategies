/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Network Growth Ride 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's daily active addresses measure real network usage — a different
 * axis from price. When usage expands above its own recent average, price tends to follow;
 * when it contracts, risk rises. We ride BTC only when network growth and price trend agree.
 * When it buys and sells: buys when active addresses are above their 30-day average (growing
 * usage) and the 100-day price trend is up; sells when network usage contracts back below its
 * average, or price closes below the 100-day trend.
 * When it does NOT work: sideways chop where address counts wiggle around their average causes
 * whipsaw; on-chain data is daily and lagged, so it cannot catch a fast intra-day crash exit.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const cash = ctx.cash;

  // ---- on-chain data (daily) ----
  const addr = ctx.data("addr");          // daily unique active addresses
  const addrSma = ctx.data("addr_sma30"); // its 30-day average
  if (addr == null || addrSma == null || addrSma <= 0) return null;
  const ratio = addr / addrSma;           // network activity vs its own 30-day mean (shape, not level)

  // ---- price trend on CLOSED bars (identical live/backtest) ----
  const prevClose = ctx.closes.at(-2);
  const sma100a = ctx.sma(100, 1);
  const sma100b = ctx.sma(100, 2);
  if (prevClose == null || sma100a == null || sma100b == null) return null;
  const trendUp = prevClose > sma100a && sma100a > sma100b;

  // ---- volatility for sizing (closed bar) ----
  const atr = ctx.atr(14, 1);
  const atrPct = atr != null && atr > 0 ? atr / price : null;

  const inPos = ctx.position > 0;

  // Entry: network expanding + price trend up. 1.03 = 3% above the 30-day mean, meaningful
  // but not extreme so we still get trades; the trend gate filters sideways chop.
  const wantBuy = !inPos && ratio > 1.03 && trendUp;
  // Exit: network contracting (0.97 = 3% below mean) OR trend broken.
  const wantSell = inPos && (ratio < 0.97 || prevClose < sma100a);

  // Watch: price-side conditions are declared; the network-contraction exit is data-only
  // (no price level exists for it) — noted in the journal.
  ctx.watch([
    { side: 'buy', price: sma100a, trigger: 'above', note: 'trend up + network growth',
      conds: [ { label: 'network ratio (addr/30d)', now: ratio, op: '>', ref: 1.03, closed: true },
               { label: 'SMA100 rising', ok: trendUp } ] },
    { side: 'sell', price: sma100a, trigger: 'below', note: 'trend break' }
  ]);

  if (wantSell) {
    return { side: 'sell', qty: ctx.position, reduceOnly: true };
  }
  if (wantBuy) {
    // Vol-target sizing: aim ~4% daily vol, cap at 80% of cash so a crash cannot ruin the account.
    let pct = 0.8;
    if (atrPct != null && atrPct > 0) pct = Math.min(0.8, 0.04 / atrPct);
    const qty = (cash * pct) / price;
    if (qty <= 0) return null;
    return { side: 'buy', qty: qty };
  }
  return null;
}
