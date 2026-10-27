/*
 * @coinsori-strategy v1
 * name: BTC Macro Yield-Filtered Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's worst bear markets (2018, 2022) both coincided with
 * rising US Treasury yields — tighter global financial conditions. The 10-year
 * yield sees that regime before the price chart does, so we use it as a risk switch
 * on top of a plain 200-day trend.
 * When it buys and sells: buys when price is above its 200-day average AND the
 * 10-year yield is NOT in a confirmed uptrend; sells when price falls below the
 * 200-day average, the yield turns up, or price drops 20% from its peak (crash stop).
 * When it does NOT work: in regimes where crypto decouples from rates (e.g.
 * crypto-specific rallies while yields rise), the filter adds nothing; it lags
 * sharp V-shaped melt-ups like every trend system.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const st = ctx.state;

  // --- Macro risk switch: 10-year US Treasury yield ---
  // base_ust10y is published on business days only, so carry forward last known.
  const yRaw = ctx.data("base_ust10y");
  if (yRaw != null && Number.isFinite(yRaw)) st.lastY = yRaw;
  const y = st.lastY;
  if (y == null) return null; // no macro data yet — stay in cash

  // Maintain a rolling 100-day yield history in state (ctx.data gives no series).
  const hist = st.yHist || [];
  hist.push(y);
  if (hist.length > 130) hist.shift();
  st.yHist = hist;
  if (hist.length < 100) return null; // need 100 days of yield history

  let sum = 0;
  for (let i = 0; i < 100; i++) sum += hist[hist.length - 1 - i];
  const ySma100 = sum / 100;
  // 1% hysteresis so a tiny yield wiggle does not flip the switch.
  const ratesStrong = y > ySma100 * 1.01;

  const pos = ctx.position;
  if (pos > 0) {
    if (price > (st.peak || price)) st.peak = price;
    // 20% trailing stop from the peak: crash protection before SMA200 turns down.
    const crashStop = (st.peak || price) * 0.80;
    const trendBroken = price < sma200;
    if (trendBroken || ratesStrong || price < crashStop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: enter only in a confirmed bull regime without a rates headwind.
  if (price > sma200 && !ratesStrong) {
    if (ctx.alloc.status !== 'ok') return null;
    st.peak = price;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
