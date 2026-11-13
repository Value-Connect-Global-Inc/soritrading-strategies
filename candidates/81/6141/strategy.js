/*
 * @coinsori-strategy v1
 * name: BTC Macro-Regime Trend Ride 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A surging US dollar is only a crypto risk-off signal when the trend is already
 * turning down (2022, 2025) — in 2021 the dollar rose while BTC trended up hard. This strategy rides
 * the 200-day uptrend at full size and steps aside only when the dollar is surging AND price has
 * broken its 50-day average.
 * When it buys and sells: Buy when price closes above the 200-day average and that macro exit is not
 * active. Sell when price closes below the 200-day average, or when the dollar is surging and price
 * closes below the 50-day average.
 * When it does NOT work: In crypto-only crashes with no dollar surge (e.g. 2018) it relies on the
 * 200-day average alone and gives back part of the top. The dollar index arrives with a 10-day lag,
 * so it cannot react to a same-day shock.
 */

function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const price = ctx.price;
  const closePrev = ctx.closes.at(-2);
  if (closePrev == null) { ctx.watch([]); return null; }

  const sma200 = ctx.sma(200, 1);
  const sma50 = ctx.sma(50, 1);

  // USD macro regime (Fed broad dollar index, lag 10d)
  const usd = ctx.data("base_usd_broad");
  const st = ctx.state || {};
  if (!st.usd) st.usd = [];
  if (usd != null) st.usd.push(usd);
  while (st.usd.length > 120) st.usd.shift(); // keep ~4 months

  // Dollar surging = >5% rise over 90+ days (a priori risk-off threshold)
  let usdHostile = false;
  if (st.usd.length >= 90) {
    if ((st.usd[st.usd.length - 1] / st.usd[0] - 1) * 100 > 5) usdHostile = true;
  }

  const trendUp = sma200 != null && closePrev > sma200;
  const shortDown = sma50 != null && closePrev < sma50;
  // Macro only matters when the short-term trend is already turning down
  const macroExit = usdHostile && shortDown;

  const watch = [];
  if (sma200 != null) {
    watch.push({ side: 'buy', price: sma200, trigger: 'above', note: 'Long: trend up', conds: [{ label: 'USD surge + short down', ok: macroExit }] });
    watch.push({ side: 'sell', price: sma200, trigger: 'below', note: 'Exit: trend broke' });
  }
  if (sma50 != null) {
    watch.push({ side: 'sell', price: sma50, trigger: 'below', note: 'Exit: USD surge + short down', conds: [{ label: 'USD surging', ok: usdHostile }] });
  }
  ctx.watch(watch);

  if (pos <= 0) {
    if (trendUp && !macroExit) {
      return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
    }
    return null;
  }

  if (pos > 0) {
    if (!trendUp || macroExit) {
      return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }
  return null;
}
