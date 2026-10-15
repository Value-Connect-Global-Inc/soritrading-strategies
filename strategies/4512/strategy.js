/*
 * @coinsori-strategy v1
 * name: Hashrate Regime Trend (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin bull markets are backed by miners adding capacity
 * (rising network hashrate), and the longest bull runs keep price above its 200-day
 * average. This is a regime filter built from on-chain data, not price momentum:
 * we only want to be long when mining commitment AND the long-term price trend are
 * both rising, and we step aside when the long-term trend breaks.
 * When it buys and sells: buys when the 30-day smoothed hashrate is above the raw
 * hashrate (hashrate rising) AND the close is above the 200-day moving average.
 * Sells when the close falls back below the 200-day moving average.
 * When it does NOT work: it is only long during confirmed bull regimes, so it misses
 * the first weeks of a rally and can give back gains in choppy ranges where price
 * repeatedly crosses the 200-day line. It is not a market-timing tool for bear rallies.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 220) return null;
  const prevClose = c.at(-2);

  const hr = ctx.data('hashrate');          // raw daily network hashrate
  const hr30 = ctx.data('hashrate_sma30');  // 30-day smoothed hashrate
  const sma200 = ctx.sma(200, 1);
  if (hr == null || hr30 == null || sma200 == null) return null;

  const hashrateRising = hr30 > hr;   // smoothed above raw = recent uptrend in miner capacity
  const uptrend = prevClose > sma200;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    if (prevClose < sma200) return { side: 'sell', qty: pos };   // long-term trend broke
    ctx.watch([{ side: 'sell', price: sma200, trigger: 'below', note: 'exit: below 200d MA',
                 conds: [{ label: 'close > 200d MA', ok: prevClose > sma200, closed: true }] }]);
    return null;
  }

  const enter = hashrateRising && uptrend;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'enter: 200d MA + hashrate rising',
               conds: [{ label: 'hashrate rising', ok: hashrateRising, closed: true },
                       { label: 'close > 200d MA', ok: uptrend, closed: true }] }]);
  if (!enter) return null;

  const qty = (ctx.cash * 0.95) / price;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
