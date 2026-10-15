/*
 * @name Donchian 55/30 + FearGreed filter (ETH 1D)
 * @ex binance
 * @syms ETH/USDT
 * @interval 1d
 * @cash 10000
 *
 * Why this strategy: Same trend-following core as the champion (55-day close
 * high entry, 30-day close low exit) but skips entries when the Fear & Greed
 * index is in extreme greed (>= 80). A new 55-day high at extreme greed is a
 * late entry near a sentiment top and whipsaws more often.
 * When it buys and sells: buys on a 55-day close high ONLY if Fear&Greed < 80.
 * Sells on a 30-day close low or a 30% hard stop.
 * When it does NOT work: if extreme-greed breakouts keep running (a melt-up),
 * skipping them forfeits part of the move; in a long sideways market the
 * breakout itself whipsaws regardless of sentiment.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes[n - 2];

  let hi55 = -Infinity;
  for (let i = n - 2 - 55; i <= n - 3; i++) {
    if (closes[i] > hi55) hi55 = closes[i];
  }
  let lo30 = Infinity;
  for (let i = n - 2 - 30; i <= n - 3; i++) {
    if (closes[i] < lo30) lo30 = closes[i];
  }

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.70;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < lo30) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '30% stop' },
               { side: 'sell', price: lo30, trigger: 'below', note: 'exit: 30d low',
                 conds: [{ label: 'close vs 30d low', ok: prevClose >= lo30, closed: true }] }]);
    return null;
  }

  const breakout = prevClose > hi55;
  if (!breakout) return null;

  // Regime filter: skip the breakout if sentiment is already extreme greed.
  // A late entry near a sentiment top whipsaws more than it gains (reason set
  // before seeing results — threshold 80 = standard "extreme greed" band).
  const fg = ctx.data('fear_greed_index');
  let allow = true;
  if (fg != null) allow = fg < 80;

  ctx.watch([{ side: 'buy', price: hi55, trigger: 'above', note: 'enter: 55d high',
               conds: [{ label: 'close vs 55d high', ok: breakout, closed: true },
                       { label: 'Fear&Greed < 80', ok: allow }] }]);
  if (!allow) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
