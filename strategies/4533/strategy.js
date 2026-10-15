/*
 * @coinsori-strategy v1
 * name: On-chain Accumulation Dip-buy (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Uses a different data axis — on-chain activity. When the
 * price is beaten down (deeply oversold) but daily active addresses are still
 * growing, it suggests real users are accumulating rather than abandoning the
 * network — a contrarian buy signal backed by usage, not just price.
 * When it buys and sells: buys when RSI(14) closes below 30 AND active
 * addresses are above their 30-day average (network still expanding). Sells
 * when the price bounces back above its 50-day average or after a 30-day
 * holding cap, with a 35% hard stop.
 * When it does NOT work: in a long bear market addresses keep falling too, so
 * the buy never triggers and the strategy stays in cash (which is fine); in a
 * slow grind down with stable addresses it can buy too early and stop out.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes[n - 2];

  const rsi = ctx.rsi(14, 1); // RSI on last CLOSED bar
  if (rsi == null) return null;

  // On-chain: active addresses vs their 30-day average (network still growing?)
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  const netGrowing = addr != null && addrAvg != null && addr > addrAvg;

  // 50-day average for the exit target
  let sum50 = 0;
  for (let i = n - 1 - 50; i <= n - 2; i++) sum50 += closes[i];
  const sma50 = sum50 / 50;

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.65; // hard stop 35% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose > sma50) return { side: 'sell', qty: pos }; // bounce target reached
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '35% stop' },
               { side: 'sell', price: sma50, trigger: 'above', note: 'exit: 50d SMA bounce' }]);
    return null;
  }

  const oversold = rsi < 30;
  ctx.watch([{ side: 'buy', note: 'dip-buy: RSI<30 + network growing',
               conds: [{ label: 'RSI(14) close', now: rsi, op: '<', ref: 30, closed: true },
                       { label: 'network growing (addr>30d avg)', ok: netGrowing, closed: true }] }]);
  if (!oversold || !netGrowing) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
