/*
 * @coinsori-strategy v1
 * name: FearGreed Contrarian BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index (0-100) measures crowd
 * emotion. Historically extreme fear (below 25) marks panic selling where
 * Bitcoin tends to recover, and extreme greed (above 75) marks euphoric tops.
 * This strategy does the opposite of trend-following: it buys panic and sells
 * euphoria.
 * When it buys and sells: buys when yesterday's Fear & Greed index is below 25
 * AND the previous close is below the 50-day EMA (a panic dip). Sells when the
 * index rises above 75 or a hard stop 25% below entry is hit. Only yesterday's
 * index value is used, so the decision never peeks at today's still-forming day.
 * When it does NOT work: in a long bear market the index can stay below 25 for
 * months while price keeps falling — the stop caps each loss but several
 * stop-outs can come in a row. It also sits in cash through quiet bull grinds
 * where greed never gets extreme.
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

  const ema50 = ctx.ema(50, 1);
  if (ema50 == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.75;   // hard stop: 25% below entry, caps a panic that keeps falling
    if (price <= stop) return { side: 'sell', qty: pos };
    if (fgPrev > 75) return { side: 'sell', qty: pos };   // euphoria -> take profit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '25% hard stop' },
               { side: 'sell', price: ctx.entryPx, trigger: 'above', note: 'greed>75 exit',
                 conds: [{ label: 'Fear&Greed', now: fgPrev, op: '>', ref: 75, closed: true }] }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const dip = prevClose < ema50;
  const panic = fgPrev < 25;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'below', note: 'panic dip buy',
               conds: [{ label: 'Fear&Greed', now: fgPrev, op: '<', ref: 25, closed: true },
                       { label: 'close < 50-EMA', ok: dip, closed: true }] }]);
  if (!panic || !dip) return null;

  const qty = (ctx.cash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
