/*
 * @coinsori-strategy v1
 * name: Multi-Asset Donchian Basket Vol-Weighted 1D - Regime Gate + DD Breaker
 * ex: binance
 * syms: BTCUSDT, ETHUSDT, SOLUSDT, ADAUSDT, XRPUSDT, DOGEUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Six-coin Donchian 55/10 breakout basket with volatility
 * weighting (each leg sized inversely to its own ATR so dollar risk is equal).
 * A 200-day regime gate blocks counter-trend breakouts below the long-term
 * average. NEW: an equity-curve drawdown circuit breaker halves position size
 * when the basket is in a deep drawdown and blocks new entries when the
 * drawdown is extreme — a hard risk floor so the account cannot be ruined.
 * When it buys and sells: on each coin, buy when a closed bar closes above its
 * 55-day high AND the coin is above its 200-day average. Sell when a closed
 * bar closes below the 10-day low or price falls 2.5 ATR below entry. After a
 * stop-out the coin pauses 10 bars. Risk is halved while the basket is down
 * more than 12% from its peak and new entries stop at 22%.
 * When it does NOT work: in a broad coordinated crypto bear all six trend
 * gates stay flat (capital safe, little upside). In a crash that hits all
 * coins at once the basket drawdown is close to a single coin's. Coins that
 * trend weakly add little and cost fees. The circuit breaker reduces recovery
 * speed after a drawdown (it caps risk, it does not create gains).
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;
  const prevClose = closes[n - 2];
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  // Vol-normalized leg share: refVol 0.04 = typical daily ATR/price of a major
  // coin. A coin with 2x that vol gets half the share, so risk is balanced.
  const atrPct = atr / price;
  const refVol = 0.04;
  let sizeMult = 0.16 * (refVol / atrPct);
  sizeMult = Math.max(0.08, Math.min(0.32, sizeMult));   // keep every leg in [8%, 32%]

  // --- equity drawdown circuit breaker ---
  // Track a running portfolio equity = shared cash + per-leg position values.
  // Halve risk at 12% drawdown, block new entries at 22%: a daily trend basket
  // should not draw down more than ~12% in normal operation, so beyond that we
  // defend the account instead of averaging down. This is a risk floor, not a
  // return enhancer.
  if (!ctx.state.eq || typeof ctx.state.eq !== 'object') ctx.state.eq = { posVal: {}, peak: 0, dd: 0 };
  const st = ctx.state.eq;
  const pos = ctx.pos(sym);
  st.posVal[sym] = pos * price;
  const equity = ctx.cash + Object.values(st.posVal).reduce((a, b) => a + b, 0);
  if (equity > st.peak) st.peak = equity;
  st.dd = st.peak > 0 ? (st.peak - equity) / st.peak : 0;
  if (st.dd > 0.12) sizeMult *= 0.5;
  if (st.dd > 0.22) sizeMult = 0;
  // --- end circuit breaker ---

  const sma200 = ctx.sma(200, 1);
  if (sma200 != null && prevClose < sma200) return null;   // regime gate: no counter-trend breakouts

  if (!ctx.state.cool || typeof ctx.state.cool !== 'object') ctx.state.cool = {};   // per-symbol cooldown

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const channelLow = Math.min(...closes.slice(-12, -2));
    const stop = entry - 2.5 * atr;
    ctx.watch([{ side: 'sell', price: channelLow, trigger: 'below', note: '10-day low trail' },
               { side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' }]);
    if (prevClose < channelLow || price < stop) {
      ctx.state.cool[sym] = ctx.i + 10;   // pause this coin after a stop-out
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.cool[sym] || 0) && sizeMult > 0) {
    ctx.state.cool[sym] = 0;
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 * sizeMult };
  }
  return null;
}
