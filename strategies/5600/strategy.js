/*
 * @coinsori-strategy v1
 * name: BTC Macro VIX-Filtered Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin crashes (2018, 2020, 2022) all happened during
 * stock-market panic, visible in the VIX fear index. A calm VIX means risk-on
 * conditions where a 200-day uptrend can be trusted; a spiking VIX is the warning
 * to step aside before the price chart confirms the damage.
 * When it buys and sells: buys when price is above its 200-day average AND the
 * VIX is below its own 100-day average (calm); sells when price falls below the
 * 200-day average, the VIX climbs above its 100-day average, or price drops 20%
 * from its peak (crash stop).
 * When it does NOT work: in crypto-specific moves that ignore equities (e.g. a
 * crypto rally while the stock market panics, or a crypto crash while stocks are
 * calm) the VIX filter adds nothing and can even keep you out of valid trends.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const st = ctx.state;

  // --- Macro risk switch: VIX fear index ---
  // VIX is published on business days only, so carry forward the last known value.
  const vRaw = ctx.data("base_vix");
  if (vRaw != null && Number.isFinite(vRaw)) st.lastVix = vRaw;
  const vix = st.lastVix;
  if (vix == null) return null; // no macro data yet — stay in cash

  // Maintain a rolling 100-day VIX history in state (ctx.data gives no series).
  const hist = st.vixHist || [];
  hist.push(vix);
  if (hist.length > 130) hist.shift();
  st.vixHist = hist;
  if (hist.length < 100) return null; // need 100 days of VIX history

  let sum = 0;
  for (let i = 0; i < 100; i++) sum += hist[hist.length - 1 - i];
  const vixSma100 = sum / 100;
  // 5% hysteresis so a small VIX wiggle does not flip the switch.
  const panic = vix > vixSma100 * 1.05;

  const pos = ctx.position;
  if (pos > 0) {
    if (price > (st.peak || price)) st.peak = price;
    // 20% trailing stop from the peak: crash protection before SMA200 turns down.
    const crashStop = (st.peak || price) * 0.80;
    const trendBroken = price < sma200;
    if (trendBroken || panic || price < crashStop) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // Flat: enter only in a confirmed bull regime with calm risk conditions.
  if (price > sma200 && !panic) {
    if (ctx.alloc.status !== 'ok') return null;
    st.peak = price;
    return { side: 'buy', qty: ctx.cash / price * 0.95 };
  }
  return null;
}
