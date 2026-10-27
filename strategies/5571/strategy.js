/*
 * @coinsori-strategy v1
 * name: BTC Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The crypto Fear & Greed index measures crowd sentiment from 0
 * (extreme fear) to 100 (extreme greed). Crowds are wrong at the extremes: capitulation
 * (extreme fear) marks selling exhaustion, euphoria (extreme greed) marks tops. This
 * strategy bets against the crowd at those extremes instead of reading candles.
 * When it buys and sells: Buys BTC when the index is below 25 (extreme fear), sells when
 * it is above 75 (extreme greed). Every position carries a -30% hard stop so a sentiment
 * signal cannot ride a continued bear down; after a stop it waits for sentiment to
 * normalize (above 50) before considering a new buy.
 * When it does NOT work: In a slow grinding bear where fear stays extreme for months, the
 * first contrarian buy is early and the stop takes the loss. It also sits in cash for
 * long stretches between extremes, so it badly lags buy-and-hold in a steady bull.
 */
function onUpdate(ctx) {
  const fg = ctx.data("fear_greed");
  if (fg == null) return null; // sentiment data not available yet (starts 2018-02)

  const price = ctx.price;
  if (price == null || price <= 0) return null;

  const pos = ctx.position;
  const entry = ctx.entryPx;

  // Restart-surviving flag: after a hard stop we wait for sentiment to normalize
  // (F&G back above 50) before a new entry, so a long fear stretch cannot whipsaw
  // us into repeated losing buys.
  let st = ctx.state || {};
  let cooldown = !!st.cooldown;

  // Hard stop: -30% from entry. Sentiment extremes are contrarian, but a continued
  // bear can fall for months — cap the loss on every position.
  if (pos > 0 && entry != null && entry > 0 && price < entry * 0.70) {
    st.cooldown = true;
    ctx.state = st;
    ctx.watch([{ side: 'sell', price: entry * 0.70, trigger: 'below', note: '30% hard stop' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // Exit on euphoria: extreme greed is the contrarian sell signal (crowd tops).
  if (pos > 0 && fg > 75) {
    ctx.watch([{ side: 'sell', note: 'F&G extreme greed' }]);
    return { side: 'sell', qty: pos, reduceOnly: true };
  }

  // Clear cooldown once sentiment has normalized.
  if (cooldown && fg > 50) {
    cooldown = false;
    st.cooldown = false;
    ctx.state = st;
  }

  // Entry: extreme fear = capitulation, contrarian buy.
  if (pos <= 0 && !cooldown && fg < 25) {
    ctx.watch([{ side: 'buy', note: 'F&G extreme fear' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
