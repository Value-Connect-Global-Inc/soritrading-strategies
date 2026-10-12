/*
 * @coinsori-strategy v1
 * name: HashrateRegimeTrend
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's mining hashrate is a real on-chain fundamental —
 * when miners are confident (hashrate rising) the network is healthy and
 * price tends to follow; when miners capitulate (hashrate falling) the market
 * is under pressure. Filtering BTC's own 200-day trend with the hashrate
 * direction keeps us long only when both price and fundamentals agree.
 * When it buys and sells: buy when BTC is above its 200-day average AND the
 * 30-day-smoothed hashrate is above its level 30 days ago (rising); sell when
 * price falls below the 200-day, hashrate turns down, or a 2x ATR stop hits.
 * When it does NOT work: hashrate is a slow series that rarely reverses, so
 * the filter mostly confirms the 200-day trend and adds little on its own; in
 * a bear where both are falling it never trades (safe but flat). If the
 * hashrate feed is missing it cannot trade.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) { ctx.watch([]); return null; }
  const sma200 = ctx.sma(200, 1);
  const atr = ctx.atr(14, 1);
  const rawHr = ctx.data('hashrate_sma30');
  // The dataset delivers the value as a string; coerce before using it.
  const hr = (rawHr == null || rawHr === '') ? null : Number(rawHr);
  if (sma200 == null || atr == null || atr <= 0 || !Number.isFinite(hr)) return null;

  // Build a rolling 30-day history of hashrate (smoothed) to measure slope.
  const st = ctx.state;
  const hist = st.hrHist || (st.hrHist = []);
  hist.push(hr);
  if (hist.length > 60) hist.shift();
  const hrPrev = hist.length > 31 ? hist[hist.length - 31] : null;
  const rising = hrPrev != null && hr > hrPrev;

  const pos = ctx.pos(ctx.sym);
  const qty = (ctx.cash / price) * 0.7;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    // Exit on the stop, a broken uptrend, or miner capitulation (hashrate down).
    if (price <= hardStop || price < sma200 || !rising) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'uptrend broke',
                 conds: [{ label: 'hashrate rising', ok: rising }] }]);
    return null;
  }

  // Long only when both agree: price above 200d and hashrate rising.
  if (price > sma200 && rising) {
    ctx.watch([]);
    return { side: 'buy', qty: qty };
  }
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'uptrend + hashrate rising',
               conds: [{ label: 'hashrate rising', ok: rising }] }]);
  return null;
}
