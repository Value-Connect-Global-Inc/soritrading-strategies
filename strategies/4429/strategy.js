/*
 * @coinsori-strategy v1
 * name: FearGreed Panic Buyer BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index (0-100) measures crowd
 * emotion. In a bull market, extreme fear (below 25) marks a panic dip that
 * historically recovers; extreme greed (above 75) marks a euphoric top. This
 * strategy buys panic dips but ONLY while the long-term uptrend is intact —
 * buying panic in a bear market is catching a falling knife.
 * When it buys and sells: buys when yesterday's Fear & Greed index is below 25
 * AND the previous close is above the 200-day SMA (secular uptrend). Sells when
 * the index rises above 75 (euphoria) or a wide 40% stop is hit (the panic
 * turned into a real bear). Uses half of cash per trade so a stop-out costs
 * about 20% of the account. Only yesterday's index value is used (no lookahead).
 * When it does NOT work: it sits in cash through the early recovery after a
 * bear (price still below the 200-day SMA), so it misses the first leg of new
 * bull markets. It also misses quiet bull grinds where greed never gets extreme.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  if (fg == null) return null;
  const fgVal = Number(fg);
  if (!Number.isFinite(fgVal)) return null;

  // Carry yesterday's index in state so today's decision uses only closed data
  const fgPrev = ctx.state.fgPrev;
  ctx.state.fgPrev = fgVal;
  if (fgPrev == null) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.6;   // wide catastrophic stop: a panic that becomes a bear
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fgPrev > 75) { ctx.log('SELL greed', ctx.i, price, fgPrev); return { side: 'sell', qty: pos }; }
    if (price <= stop) { ctx.log('SELL stop', ctx.i, price, fgPrev); return { side: 'sell', qty: pos }; }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '40% stop' },
               { side: 'sell', price: ctx.entryPx, trigger: 'above', note: 'greed>75 exit',
                 conds: [{ label: 'Fear&Greed', now: fgPrev, op: '>', ref: 75, closed: true }] }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const bull = prevClose > sma200;   // only buy panics inside a secular uptrend
  const panic = fgPrev < 25;
  if (panic) ctx.log('PANIC day', ctx.i, price, fgPrev, 'bull=' + bull, 'sma200=' + sma200.toFixed(0));
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'panic buy in uptrend',
               conds: [{ label: 'Fear&Greed', now: fgPrev, op: '<', ref: 25, closed: true },
                       { label: 'close > 200-SMA', ok: bull, closed: true }] }]);
  if (!panic || !bull) return null;

  const qty = (ctx.cash / price) * 0.5;   // half cash per trade: a stop-out costs ~20% of cash
  if (qty <= 0) return null;
  ctx.log('BUY', ctx.i, price, fgPrev);
  return { side: 'buy', qty };
}
