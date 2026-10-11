/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Sentiment Reversal 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The fear-greed index measures crowd sentiment. Extreme
 * fear (index <= 20) marks panic where prices are already discounted and tend
 * to revert upward; extreme greed marks euphoria where the easy move is done.
 * We buy the panic only inside a confirmed long-term uptrend, so we never
 * catch a structural bear's falling knife.
 * When it buys and sells: buy when the fear-greed index is <= 20 AND price is
 * above the 200-day EMA. Sell when the index reaches >= 60 (greed), or price
 * closes below the 50-day EMA, or a 2x ATR stop from entry is hit.
 * When it does NOT work: in a long bear the index stays low for months — we
 * avoid it via the EMA200 filter, so we simply sit out. In a choppy bull the
 * index rarely hits 20, so few trades and long flat periods. It misses
 * melt-ups where sentiment never gets fearful enough to trigger a buy.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const ema200 = ctx.ema(200, 1);
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (fg == null || ema200 == null || ema50 == null || atr == null) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const stopPx = ctx.entryPx - 2 * atr;
    if (price <= stopPx) return { side: 'sell', qty: pos };
    // sentiment recovered to greed → take profit
    if (fg >= 60) return { side: 'sell', qty: pos };
    if (price < ema50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: 'trend broke' },
               { side: 'sell', note: 'greed', conds: [{ label: 'fear-greed', now: fg, op: '>=', ref: 60, closed: true }] }]);
    return null;
  }

  // extreme fear only
  if (fg > 20) return null;
  // long-term uptrend must be intact — never catch a structural bear
  if (price <= ema200) return null;

  const riskCash = ctx.cash * 0.01;        // 1% equity risked per trade
  const stopDist = 2 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price; // cap at 30% of cash
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
