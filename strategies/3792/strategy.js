/*
 * @coinsori-strategy v1
 * name: DollarRegime BTC Allocation
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Over long stretches Bitcoin and the US dollar move in opposite directions — when the dollar is weak, risk assets like BTC get bid; when the dollar strengthens, BTC tends to stall or fall. This bets on that long macro link instead of on price patterns.
 * When it buys and sells: Buys BTC when the dollar index (DXY, external dataset) is below its own 200-day average (weak-dollar regime) and there is no position. Sells and holds cash when DXY is above its 200-day average (strong-dollar regime), or when price falls 30% below entry (disaster stop).
 * When it does NOT work: When the dollar and crypto decouple (e.g. late 2021, and 2023-2024 when BTC rallied while the dollar was merely not-weak), the filter stays in cash and misses the bull run. It lags every regime change by the length of the 200-day average, so it enters late and exits late.
 */
function onUpdate(ctx) {
  // DXY is a business-days-only dataset: null on weekends. Keep a rolling history of known values.
  const dxy = ctx.data('dxy');
  const st = ctx.state;
  if (st.hist == null) st.hist = [];
  if (dxy != null && dxy !== st.last) {
    st.hist.push(dxy);
    if (st.hist.length > 210) st.hist.shift();
    st.last = dxy;
  }
  if (st.hist.length < 200) return null; // need 200 business days of DXY before the regime is defined

  const arr = st.hist;
  let sum = 0;
  for (let i = arr.length - 200; i < arr.length; i++) sum += arr[i];
  const sma200 = sum / 200;
  const cur = arr[arr.length - 1];
  const weakDollar = cur < sma200; // DXY below its 200-day average = risk-on regime

  const watch = [];

  // Disaster stop: 30% below entry as tail protection, wide enough not to stop out normal vol.
  if (ctx.position > 0 && ctx.entryPx != null) {
    const stop = ctx.entryPx * 0.70;
    watch.push({ side: 'sell', price: stop, trigger: 'below', note: '30% disaster stop' });
    if (ctx.price <= stop) return { side: 'sell', qty: ctx.position };
  }

  if (ctx.position === 0) {
    watch.push({ side: 'buy', conds: [{ label: 'DXY<SMA200', now: cur, op: '<', ref: sma200, closed: true }], note: 'weak dollar regime' });
    if (weakDollar) {
      ctx.watch(watch);
      return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
    }
  } else {
    watch.push({ side: 'sell', conds: [{ label: 'DXY>SMA200', now: cur, op: '>', ref: sma200, closed: true }], note: 'strong dollar regime' });
    if (!weakDollar) {
      ctx.watch(watch);
      return { side: 'sell', qty: ctx.position };
    }
  }
  ctx.watch(watch);
  return null;
}
