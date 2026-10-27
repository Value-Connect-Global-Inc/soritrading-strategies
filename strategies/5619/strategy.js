/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Demand Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: price alone misses what on-chain usage shows. Bitcoin's
 * daily unique active addresses measure real network demand. The raw daily
 * count is noisy, so this version uses the 30-day smoothed average (addr_sma30)
 * as the demand trend and compares it to the same average ~60 days earlier.
 * When that smoothed usage is rising AND price is above its 200-day average,
 * real usage is expanding inside an uptrend — buy. When smoothed usage turns
 * down, demand is contracting — sell. Slower than the daily cross, so it
 * churns far less.
 * When it does NOT work: on-chain usage lags price in fast speculative
 * melt-ups and is a weak signal in choppy sideways markets; the smoothed
 * trend still whipsaws when usage oscillates without direction.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const addrAvg = ctx.data('addr_sma30');
  if (addrAvg == null || addrAvg <= 0) return null;

  // Keep a rolling history of the smoothed usage so we can compare it to
  // ~60 bars ago (a slow trend, the on-chain analog of OBV(30)).
  const st = ctx.state;
  if (!Array.isArray(st.hist)) st.hist = [];
  st.hist.push(addrAvg);
  if (st.hist.length > 61) st.hist.shift();
  if (st.hist.length < 61) return null;
  const past = st.hist[st.hist.length - 61];

  // 1% hysteresis: small drift in smoothed usage is noise.
  const demandRising = addrAvg > past * 1.01;
  const demandFalling = addrAvg < past * 0.99;

  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: price, trigger: 'below', note: 'demand contracting', conds: [{ label: 'addr30 trend down', ok: demandFalling }] }
    ]);
    if (demandFalling && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'demand rising entry', conds: [
      { label: 'addr30 trend up', ok: demandRising },
      { label: 'Price > SMA200', ok: price > sma200 }
    ]}
  ]);
  if (demandRising && price > sma200 && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
