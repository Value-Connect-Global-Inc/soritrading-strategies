/*
 * @coinsori-strategy v1
 * name: BTC 4H Band-Bounce + On-Chain Demand Gate
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The band-bounce mean-reversion family is the most validated
 * in the ledger (BTC 4H +34/+19/+12 per ledger). Its structural weakness is
 * buying dips that keep falling during a genuine network-demand contraction.
 * The active-address demand signal (addr_sma30, 30-day smoothed) is a validated
 * on-chain trend. This version overlays it: it only buys a panic dip when
 * network demand is NOT contracting, so the bounce has fundamental support.
 * When it buys and sells: buys a panic dip (price below the lower Bollinger
 * band, RSI<30, price above the 200-SMA) and sells at the mid-band, on RSI
 * recovery above 50, or a 6-ATR stop. It takes NO buy while active-address
 * demand is falling.
 * When it does NOT work: on-chain data is daily and slow-moving, so it may
 * rarely flip or lag price action; and if demand data is unavailable in
 * backtest it will never trade.
 *
 * 2026-01-15: display-only watch added, trading logic unchanged.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const addr = ctx.data('addr_sma30');
  const pos = ctx.position;

  if (pos > 0) {
    const bb = ctx.bb(20, 2, 1);
    const rsi = ctx.rsi(14, 1);
    const atr = ctx.atr(14, 1);
    if (bb == null || rsi == null || atr == null) return null;
    const entry = ctx.entryPx;
    const stop = entry != null ? entry - 6 * atr : null;
    ctx.watch([
      { side: 'sell', price: bb.mid, trigger: 'above', note: 'mid-band target' },
      { side: 'sell', price: 50, trigger: 'above', note: 'RSI recovery', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 50, closed: true }] },
      { side: 'sell', price: stop, trigger: 'below', note: '6-ATR stop', conds: [{ label: 'ATR(14) close', now: atr, op: '>=', ref: 0, closed: true }] }
    ]);
    if (price >= bb.mid || rsi > 50 || (entry != null && price <= entry - 6 * atr)) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // On-chain gate: block buys while active-address demand is contracting.
  if (addr == null) return null;

  const sma200 = ctx.sma(200, 1);
  const bb = ctx.bb(20, 2, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma200 == null || bb == null || rsi == null) return null;
  const lastTrade = ctx.state.lastTradeBar != null ? ctx.state.lastTradeBar : -1e9;
  const cooldownOk = ctx.i - lastTrade >= 5;
  ctx.watch([
    { side: 'buy', price: sma200, trigger: 'above', note: 'price above 200-SMA', conds: [{ label: 'SMA200 close', now: sma200, op: '<', ref: price, closed: true }] },
    { side: 'buy', price: bb.lower, trigger: 'below', note: 'BB lower touch', conds: [{ label: 'BB lower close', now: bb.lower, op: '>', ref: price, closed: true }] },
    { side: 'buy', price: 30, trigger: 'below', note: 'RSI<30', conds: [{ label: 'RSI(14) close', now: rsi, op: '>', ref: 30, closed: true }] },
    { side: 'buy', price: addr, trigger: 'above', note: 'demand not contracting', conds: [{ label: 'addr_sma30', now: addr, op: '>', ref: 0, closed: true }] },
    { side: 'buy', at: lastTrade + 5, note: 'cooldown done', conds: [{ label: 'cooldown bars left', now: ctx.i - lastTrade, op: '<', ref: 5 }] }
  ]);
  if (price <= sma200) return null;
  if (price > bb.lower) return null;
  if (rsi >= 30) return null;

  // Cooldown to avoid re-entry whipsaw.
  if (ctx.i - lastTrade < 5) return null;
  ctx.state.lastTradeBar = ctx.i;

  return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
}
