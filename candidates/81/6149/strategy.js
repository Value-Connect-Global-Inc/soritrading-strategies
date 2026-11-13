/*
 * @coinsori-strategy v1
 * name: BTC Perp Funding-Trend 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: On perpetual futures the funding rate shows which side is crowded. When funding
 * is far above its own recent norm, longs are paying to stay long (a crowded long that tends to
 * flush); when it is far below, shorts are crowded. This rides the trend but only takes the side
 * that is NOT crowded, and it can trade both long and short, so it can also earn in falling markets.
 * When it buys and sells: Long when price is above the 50-bar average AND funding is below its
 * recent norm (shorts crowded, squeeze fuel). Short when price is below the 50-bar average AND
 * funding is above its recent norm (crowded longs). Exit on the trend flip or a 3xATR trailing stop.
 * When it does NOT work: In a quiet low-volatility range funding hovers near zero, the crowding
 * filter adds no edge and the strategy just pays fees. Funding is perpetual-only — it has no signal
 * on spot markets, and a sustained one-way trend with one-sided funding can fight the strategy.
 */

function onUpdate(ctx) {
  const pos = ctx.position || 0;
  const price = ctx.price;
  const closes = ctx.closes;
  if (closes == null || closes.length < 60) { ctx.watch([]); return null; }
  const closePrev = closes.at(-2);
  const highPrev = ctx.highs.at(-2);
  const lowPrev = ctx.lows.at(-2);
  if (closePrev == null || highPrev == null || lowPrev == null) { ctx.watch([]); return null; }

  const fund = ctx.funding;
  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || atr == null) { ctx.watch([]); return null; }

  // keep a rolling history of funding values (funding updates ~every 8h; dedup consecutive values)
  let st = ctx.state || {};
  if (!Array.isArray(st.fundHist)) st.fundHist = [];
  if (fund != null) {
    const last = st.fundHist[st.fundHist.length - 1];
    if (last == null || Math.abs(last - fund) > 1e-12) st.fundHist.push(fund);
    if (st.fundHist.length > 120) st.fundHist = st.fundHist.slice(-120);
  }
  ctx.state = st;

  // funding z-score vs its own recent norm — shape is relative, so it adapts to bull vs bear regimes
  let fz = null;
  if (st.fundHist.length >= 30 && fund != null) {
    const arr = st.fundHist.slice(-90);
    let m = 0; for (const v of arr) m += v; m /= arr.length;
    let s = 0; for (const v of arr) s += (v - m) * (v - m); s = Math.sqrt(s / arr.length);
    if (s > 1e-9) fz = (fund - m) / s;
  }
  if (fz == null) { ctx.watch([]); return null; }

  const up = closePrev > ema50;
  const down = closePrev < ema50;

  // size so a 2xATR adverse move costs ~2% of equity; cap at full cash so we never over-allocate
  const qty = Math.max(0, Math.min(ctx.cash / price, (ctx.cash * 0.02) / (2 * atr)));

  if (pos === 0) {
    st.hh = null; st.ll = null;
    ctx.state = st;
    ctx.watch([
      { side: 'buy', price: ema50, trigger: 'above', note: 'Long: trend up, funding below norm' },
      { side: 'sell', price: ema50, trigger: 'below', note: 'Short: trend down, funding above norm' }
    ]);
    // +/-0.5 z-score = mild crowding filter (enter only when our side is not the crowded one)
    if (up && fz < -0.5 && qty > 0) return { side: 'buy', qty };
    if (down && fz > 0.5 && qty > 0) return { side: 'sell', qty };
    return null;
  }

  if (pos > 0) {
    if (st.hh == null) st.hh = highPrev; else if (highPrev > st.hh) st.hh = highPrev;
    ctx.state = st;
    const stop = st.hh - 3 * atr;
    ctx.watch([
      { side: 'sell', price: stop, trigger: 'below', note: 'Long trailing stop (3xATR)' },
      { side: 'sell', price: ema50, trigger: 'below', note: 'Long exit: trend flip' }
    ]);
    if (closePrev < stop || down) return { side: 'sell', qty: Math.abs(pos), reduceOnly: true };
    return null;
  }

  // short position
  if (st.ll == null) st.ll = lowPrev; else if (lowPrev < st.ll) st.ll = lowPrev;
  ctx.state = st;
  const stop = st.ll + 3 * atr;
  ctx.watch([
    { side: 'buy', price: stop, trigger: 'above', note: 'Short stop (3xATR)' },
    { side: 'buy', price: ema50, trigger: 'above', note: 'Short exit: trend flip' }
  ]);
  if (closePrev > stop || up) return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
  return null;
}
