/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Demand Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: price alone misses what on-chain usage shows. Bitcoin's
 * daily unique active addresses measure real network demand — people actually
 * using the chain. When active addresses run above their 30-day average, usage
 * is expanding (real demand building); when they fall below, usage is
 * contracting. This is a different information source than price or volume.
 * When it buys and sells: buys when active addresses are above their 30-day
 * average AND price is above its 200-day average (uptrend); sells when active
 * addresses drop below their 30-day average (demand contracting). Hysteresis
 * and a cooldown cut churn.
 * When it does NOT work: on-chain usage is noisy and lags price in fast
 * speculative melt-ups; in choppy sideways markets the address signal
 * whipsaws like any trend signal.
 */
function onUpdate(ctx) {
  const pos = ctx.position;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  if (addr == null || addrAvg == null || addrAvg <= 0) return null;

  // 2% hysteresis band around the 30-day average: small noise in the daily
  // address count should not flip the signal.
  const demandUp = addr > addrAvg * 1.02;
  const demandDown = addr < addrAvg * 0.98;

  const st = ctx.state;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  ctx.state.cd = cd;

  if (pos > 0) {
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'SMA200 trend break' },
      { side: 'sell', price: price, trigger: 'below', note: 'demand contracting', conds: [{ label: 'addr < avg30*0.98', ok: demandDown }] }
    ]);
    if (demandDown && cd === 0) {
      ctx.state.cd = 5;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([
    { side: 'buy', price: price, trigger: 'above', note: 'demand rising entry', conds: [
      { label: 'addr > avg30*1.02', ok: demandUp },
      { label: 'Price > SMA200', ok: price > sma200 }
    ]}
  ]);
  if (demandUp && price > sma200 && cd === 0) {
    if (ctx.alloc.status !== 'ok') return null;
    ctx.state.cd = 5;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
