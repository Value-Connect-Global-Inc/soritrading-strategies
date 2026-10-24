/*
 * @coinsori-strategy v1
 * name: Network Trend Rider
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's long-term price trend tends to follow real network usage. When price is
 * above its 200-day average AND on-chain activity (30-day average of active addresses) is still growing,
 * the market is in a healthy uptrend worth riding.
 * When it buys and sells: We hold BTC while price stays above its 200-day average and network activity
 * keeps growing. We move to cash when price drops below that average or network growth stops — the regime
 * has turned and we protect capital.
 * When it does NOT work: In long sideways ranges the two filters flip often and cause many small whipsaw
 * losses. It also gives back the very last euphoric leg of a bull run, because on-chain activity usually
 * peaks before price does.
 */

function onUpdate(ctx) {
  const state = ctx.state || (ctx.state = {});
  const sma200 = ctx.sma(200, 1);
  const addr = ctx.data('addr_sma30');
  if (sma200 == null || addr == null) return null;

  // Keep a short history of the on-chain series so we can measure its direction.
  state.addrHist = state.addrHist || [];
  state.addrHist.push(addr);
  if (state.addrHist.length > 300) state.addrHist.shift();
  if (state.addrHist.length < 15) return null;

  // Network is still growing if the smoothed series is above its value ~1 week ago.
  const rising = addr > state.addrHist[state.addrHist.length - 8];
  const uptrend = ctx.price > sma200;

  if (ctx.position === 0) {
    if (!uptrend || !rising) return null;
    ctx.watch([{ side: 'sell', price: ctx.price * 0.75, trigger: 'below', note: 'stop -25%' }]);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }

  if (ctx.position > 0) {
    const entry = ctx.entryPx;
    const stop = entry != null ? entry * 0.75 : null;
    const watch = [];
    if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'stop -25%' });
    watch.push({ side: 'sell', price: sma200, trigger: 'below', note: 'trend broken' });
    ctx.watch(watch);
    if (stop != null && ctx.price <= stop) return { side: 'sell', qty: ctx.position };
    if (!uptrend || !rising) return { side: 'sell', qty: ctx.position };
  }
  return null;
}
