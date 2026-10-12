/*
 * @coinsori-strategy v1
 * name: FearGreedContrarian
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crowd sentiment (the Fear & Greed index) mean-reverts —
 * buying when the crowd is terrified inside an intact uptrend catches panics
 * that historically resolve higher, and selling into extreme greed locks in
 * the move before the crowd turns.
 * When it buys and sells: buy BTC when the index is below 25 (extreme fear)
 * AND price is above its 200-day average; sell when the index is above 78,
 * when price falls below the 200-day, or on a 2x ATR stop.
 * When it does NOT work: in a long bear where price stays below the 200-day
 * it never trades (safe but flat); in a grinding bear the 25 threshold can
 * keep buying falling knives that stop out repeatedly.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }

  const sma200 = ctx.sma(200, 1);
  // The dataset delivers the index as a string; coerce to a real number.
  const fgRaw = ctx.data('fear_greed');
  const fg = Number(fgRaw);
  if (sma200 == null || fgRaw == null || !Number.isFinite(fg)) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const atr = ctx.atr(14, 1);
    if (atr == null || atr <= 0) return null;
    // 2x ATR below entry: tail-risk stop sized to volatility.
    const hardStop = ctx.entryPx - 2 * atr;
    if (fg > 78 || price < sma200 || price <= hardStop) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'regime exit' }]);
    return null;
  }

  // Contrarian entry: extreme fear (<25) + uptrend intact (price>200d).
  // The 200-day filter keeps us from buying knives in a confirmed bear.
  if (fg < 25 && price > sma200) {
    ctx.watch([]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.98 };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend + fear',
               conds: [{ label: 'FG index', now: fg, op: '<', ref: 25, closed: true }] }]);
  return null;
}
