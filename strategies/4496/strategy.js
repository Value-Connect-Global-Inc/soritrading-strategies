/*
 * @coinsori-strategy v1
 * name: Uptrend Dip-Buyer BB (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: in a confirmed long-term uptrend, sharp pullbacks to the lower
 * Bollinger band are usually temporary overshoots that revert back toward the mean.
 * We buy those oversold dips and capture the bounce, instead of buying breakouts.
 * When it buys and sells: buys when the close is above a RISING 200-day EMA (regime
 * filter) and the close touches the lower Bollinger band (2 sigma below the 20-day
 * mean). Sells when the close recovers above the band midpoint, the 200-day trend
 * breaks, or a 10% hard stop is hit.
 * When it does NOT work: in a bear market or a long chop, pullbacks keep falling and
 * the 10% stop is hit repeatedly — losses stack. It also underperforms a pure trend
 * follower during strong one-way bull runs, where dips are shallow and rare.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const ema200Prev = ctx.ema(200, 31);   // 200-day EMA 30 bars ago, to check it is rising
  if (ema200 == null || ema200Prev == null) return null;

  const bb = ctx.bb(20, 2, 1);
  if (bb == null) return null;

  const c = ctx.closes;
  if (c.length < 2) return null;
  const prevClose = c.at(-2);

  // regime: long-term uptrend must be intact AND the 200-day EMA itself rising
  const uptrend = prevClose > ema200 && ema200 > ema200Prev;

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);   // size so position targets ~2% daily vol
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.90;         // hard stop: 10% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend broke = dip became reversal
    if (prevClose > bb.mid) return { side: 'sell', qty: pos };   // recovered to the mean
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '10% stop' },
               { side: 'sell', price: bb.mid, trigger: 'above', note: 'recovered to band mid',
                 conds: [{ label: 'close > 200-EMA', ok: prevClose > ema200, closed: true }] }]);
    return null;
  }

  // entry: uptrend regime + close touched the lower band (2 sigma below the 20-day mean)
  const dipped = prevClose <= bb.lower;
  ctx.watch([{ side: 'buy', price: bb.lower, trigger: 'below', note: 'touch lower band',
               conds: [{ label: 'close > 200-EMA', ok: prevClose > ema200, closed: true },
                       { label: '200-EMA rising', ok: ema200 > ema200Prev, closed: true }] }]);
  if (!uptrend || !dipped) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
