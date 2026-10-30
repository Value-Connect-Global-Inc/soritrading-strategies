/*
 * @coinsori-strategy v1
 * name: BTC OnChain Adoption Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's active-address count is a fundamental usage signal — growing network
 * activity tends to accompany real adoption-driven bull markets, not just sentiment spikes. Buying
 * only when on-chain usage is expanding AND price is in a long-term uptrend filters out sentiment
 * bounces that have no fundamental support. This is a different information source than price or
 * sentiment: it measures how many people are actually using the network.
 * When it buys and sells: Buy when the 30-day average of active addresses is above its value 30 days
 * ago (adoption expanding), the 200-bar average is rising, and price is above it. Sell when price
 * falls back below the 200-bar average (trend broken) or on a 12% hard stop.
 * When it does NOT work: In a bear market the trend gate keeps it out (good), but on-chain usage can
 * keep growing during a price decline (late adopters), so the adoption gate is not a perfect top
 * signal. It lags buy-and-hold in a relentless bull, and a fast crash can hit the stop before the
 * 200-bar average turns down.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const addr30 = ctx.data('addr_sma30'); // 30-day avg of daily active addresses
  if (addr30 == null) return null;

  // Keep daily adoption history: push only when the daily value changes (4h bars repeat it).
  const hist = ctx.state.hist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== addr30) {
    hist.push(addr30);
    if (hist.length > 90) hist.shift();
  }
  ctx.state.hist = hist;
  if (hist.length < 60) return null; // need ~60 days of adoption history

  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  if (sma200 == null || sma200prev == null) return null;
  const trendUp = sma200 > sma200prev;
  const adoptionRising = addr30 > hist[hist.length - 31]; // today vs 30 days ago

  if (pos > 0) {
    const entryPx = ctx.entryPx;
    const stop = (entryPx != null) ? entryPx * 0.88 : null; // 12% hard stop on every position
    ctx.watch([
      { side: 'sell', price: sma200, trigger: 'below', note: 'trend broken SMA200' },
      { side: 'sell', price: stop, trigger: 'below', note: '12% stop' }
    ]);
    if (price < sma200) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    if (entryPx != null && price < entryPx * 0.88) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'adoption up + trend up', conds: [
    { label: 'addr30 rising vs 30d ago', ok: adoptionRising },
    { label: 'SMA200 rising', ok: trendUp }
  ]}]);
  if (adoptionRising && trendUp && price > sma200) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }
  return null;
}
