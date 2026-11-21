/*
 * @coinsori-strategy v1
 * name: BTC FearGreed Sentiment MeanRev 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The crypto Fear & Greed index swings to extremes — deep fear
 * after sell-offs and euphoric greed after rallies. In a longer-term uptrend, a
 * spike to extreme fear is usually a temporary panic that mean-reverts, and
 * extreme greed marks a good place to take profit. This bets on that sentiment
 * reversion, but only inside a confirmed uptrend so it does not catch a falling
 * knife in a bear market.
 * When it buys and sells: Buy when the Fear & Greed index is at or below 25
 * (extreme fear) while BTC is above its 200-day average (uptrend intact). Sell
 * when the index reaches or exceeds 75 (extreme greed) or when the 200-day trend
 * rolls over. A 30% hard stop protects any single bad entry.
 * When it does NOT work: In a sustained bear market the 200-day filter keeps it in
 * cash (safe but no upside, loses to holding in a rising window); if the index
 * stays in a mid-range it trades little; and a panic can keep falling even at
 * extreme fear, hitting the 30% stop.
 */
function onUpdate(ctx) {
  // Fear & Greed index (0-100). null until it has data; guard before use.
  const fg = ctx.data('main.fear_greed');
  const sma = ctx.sma(200, 1);
  const smaOld = ctx.sma(200, 20);
  if (sma == null || smaOld == null) { ctx.watch([]); return null; }

  const price = ctx.price;
  if (price == null || price <= 0) { ctx.watch([]); return null; }

  const pos = ctx.position || 0;
  const uptrend = price > sma && sma > smaOld;

  // restart-surviving close of a position whose entry price is unknown
  if (pos !== 0 && ctx.entryPx == null) {
    const side = pos > 0 ? 'sell' : 'buy';
    ctx.watch([{ side: side, price: price, trigger: pos > 0 ? 'below' : 'above', note: 'restart close' }]);
    return { side: side, qty: Math.abs(pos), reduceOnly: true };
  }

  if (pos > 0) {
    const entry = ctx.entryPx != null ? ctx.entryPx : price;
    const stopPx = entry * 0.70; // hard stop at -30%
    const greedy = fg != null && fg >= 75; // extreme greed: take profit
    ctx.watch([
      { side: 'sell', price: sma, trigger: 'below', note: 'trend rollover exit' },
      { side: 'sell', price: stopPx, trigger: 'below', note: 'hard stop -30%' }
    ]);
    if (greedy || !uptrend || price <= stopPx) return { side: 'sell', qty: pos, reduceOnly: true };
    return null;
  }

  // flat: buy only on extreme fear inside a confirmed uptrend
  if (uptrend && fg != null && fg <= 25) {
    const qty = (ctx.cash * 0.98) / price;
    if (qty <= 0) { ctx.watch([]); return null; }
    ctx.watch([{ side: 'buy', price: sma, trigger: 'above', note: 'uptrend entry' }]);
    return { side: 'buy', qty };
  }
  ctx.watch([]);
  return null;
}
