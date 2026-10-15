/*
 * @coinsori-strategy v1
 * name: Sentiment-Gated Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin rallies that happen while the crowd is already euphoric
 * (extreme greed) tend to be blow-off tops, while rallies from fear/neutral sentiment
 * have more room to run. We gate our momentum buy on sentiment being below the
 * extreme-greed threshold.
 * When it buys and sells: buys when 30-day return is positive, close is above the
 * 200-day EMA, and the Fear&Greed index is below 80 (not extreme greed). Sells when
 * the close falls below the 200-day EMA, 30-day return turns negative, or a 15%
 * hard stop is hit.
 * When it does NOT work: in a sustained euphoric bull market where the index stays
 * above 80 for long stretches, the gate keeps us out of the strongest part of the
 * trend. It also relies on the sentiment series being present.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    if (mom30 < 0) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break' }]);
    return null;
  }

  const fg = ctx.data('fear_greed');
  // sentiment gate: skip entries when the crowd is in extreme greed (>=80).
  // missing data defaults to allowing the trade so the strategy never silently blocks.
  let notEuphoric = true;
  if (fg != null) notEuphoric = fg < 80;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'F&G < 80', ok: notEuphoric, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !notEuphoric) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
