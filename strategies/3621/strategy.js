/*
 * @coinsori-strategy v1
 * name: ETH Sentiment-Gated Trend 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: buy 20-bar breakouts in an uptrend when crypto sentiment
 *   is not at a blow-off top. Volume confirmation on the breakout bar filters
 *   out weak, fake breakouts.
 * When it buys and sells: buy when Fear&Greed < 75, price above the 100-EMA, a
 *   fresh 20-bar high closes on above-average volume. Sell on an ATR trailing
 *   stop (ratchets up with the 20-bar high, so winners run), or when the close
 *   falls back below the 100-EMA.
 * When it does NOT work: misses melt-ups (sentiment gate stays out), and the
 *   trend-break exit can cut strong trends short during sharp but healthy pullbacks.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    // ATR trailing stop: starts 2.5x ATR below entry, ratchets up with the 20-bar high
    const hh20 = ctx.high(20, 1);
    if (hh20 == null) return null;
    const trail = Math.max(ctx.entryPx - 2.5 * atr, hh20 - 2.5 * atr);
    const trendBreak = prevClose < ema100;
    if (price <= trail) return { side: 'sell', qty: ctx.position };
    if (trendBreak) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: trail, trigger: 'below', note: 'ATR trailing stop' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }

  if (fg != null && fg >= 75) return null;   // only a blow-off top blocks entry (fg null = data off, skip gate)
  if (prevClose <= ema100) return null;      // only buy in an uptrend
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;   // enter only on a FRESH breakout
  // volume confirmation: the breakout bar must trade above its 20-bar average volume
  const volPrev = ctx.volPrev;
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) return null;
  if (volPrev < avgVol) return null;

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
