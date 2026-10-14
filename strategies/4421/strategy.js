/*
 * @coinsori-strategy v1
 * name: Fear-Greed Panic Buy BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed index measures crowd emotion
 * (0 = extreme fear, 100 = extreme greed). Crowds are usually wrong at the
 * extremes: panic selling creates cheap entries, euphoria creates expensive
 * exits. This strategy buys only when the crowd is panicking AND the long-term
 * uptrend is still intact, and sells when the crowd turns euphoric or the
 * trend breaks.
 * When it buys and sells: buys when the Fear & Greed index is below 30
 * (fear) and the previous close is above the 100-day SMA (uptrend intact).
 * Sells when the index rises above 80 (extreme greed), price closes below
 * the 100-day SMA, or a 2.5x ATR hard stop is hit. Each trade risks 2% of
 * cash.
 * When it does NOT work: in a genuine bear market the panic dip keeps falling
 * and the trend filter keeps us out (good), but it also misses the whole
 * rally if fear never gets extreme; and in a slow grind down it whipsaws.
 * It needs the Fear & Greed data (starts 2018-02), so it never trades
 * before that date.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma100 = ctx.sma(100, 1);
  const atr = ctx.atr(14, 1);
  if (sma100 == null || atr == null || atr <= 0) return null;

  // Crowd sentiment: 0 (extreme fear) .. 100 (extreme greed)
  const fgRaw = ctx.data('fear_greed');
  const fg = fgRaw == null ? null : Number(fgRaw);
  const fgOk = fg != null && Number.isFinite(fg);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    const trendBreak = prevClose != null && prevClose < sma100;
    const euphoria = fgOk && fg > 80;       // sell into extreme greed
    if (trendBreak || euphoria) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: sma100, trigger: 'below', note: '100d trend break' },
               { side: 'sell', price: 80, trigger: 'above', note: 'extreme greed exit',
                 conds: [{ label: 'F&G index', now: fgOk ? fg : null, op: '>', ref: 80, closed: true }] }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > sma100;
  const fear = fgOk && fg < 30;             // buy crowd fear dips only
  ctx.watch([{ side: 'buy', price: sma100, trigger: 'above', note: 'close above 100d SMA',
               conds: [{ label: 'close > 100d', ok: uptrend, closed: true },
                       { label: 'F&G < 30', now: fgOk ? fg : null, op: '<', ref: 30, closed: true }] }]);
  if (!uptrend || !fear) return null;

  const riskCash = ctx.cash * 0.02;         // risk 2% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
