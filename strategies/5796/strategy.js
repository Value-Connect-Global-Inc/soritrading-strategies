/*
 * @coinsori-strategy v1
 * name: MultiAsset MR Basket + RatesGate 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same validated 5-asset defensive mean-reversion basket as the champion,
 * but with a macro regime gate: dip-buys are only allowed while the US 10Y Treasury yield is
 * below its 1-year average (accommodative risk-on). Rising rates tighten financial conditions
 * and compress crypto risk appetite, so buying dips into a rising-rate regime is riskier.
 * When it does NOT work: The gate is slow (2-day lag, 1-year average) so it cannot protect
 * against fast liquidity crashes that happen while rates are still low; and in a long
 * low-rate bull it never blocks anything, so it behaves exactly like the ungated basket.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const bb = ctx.bb(20, 2.5, 1);
  const rsi = ctx.rsi(14, 1);
  const sma200 = ctx.sma(200, 1);
  const sma200prev = ctx.sma(200, 2);
  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  if (bb == null || rsi == null || sma200 == null || sma200prev == null || ema20 == null || atr == null || atr <= 0) return null;

  // Macro rates regime: 10Y yield below its 1-year (250-bar) rolling average = accommodative.
  // Rolling history kept in ctx.state so it survives restarts; gate defaults to ON (allow)
  // until we have a full year of rate observations.
  const ust10y = ctx.data("base_ust10y");
  let rates = ctx.state.rates || [];
  if (ust10y != null) {
    rates.push(ust10y);
    if (rates.length > 250) rates.shift();
    ctx.state.rates = rates;
  }
  let len = rates.length;
  let ratesAvg = null;
  if (len >= 250) {
    let sum = 0;
    for (let k = 0; k < len; k++) sum += rates[k];
    ratesAvg = sum / len;
  }
  const macroOk = ratesAvg == null || ust10y < ratesAvg;

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;
  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const entry = ctx.entryPx;
    const halfSold = ctx.state.halfSold === true;
    const trailMult = halfSold ? 1.5 : 2.5;
    const trailStop = peak - trailMult * atr;
    const profitTarget = entry != null && entry > 0 ? entry + 1.5 * atr : null;
    const watchList = [{ side: 'sell', price: trailStop, trigger: 'below', note: 'ATR trail stop' },
                      { side: 'sell', price: ema20, trigger: 'above', note: 'EMA20 exit' }];
    if (!halfSold && profitTarget != null) watchList.push({ side: 'sell', price: profitTarget, trigger: 'above', note: 'half profit target' });
    ctx.watch(watchList);
    if (!halfSold && profitTarget != null && price >= profitTarget) {
      ctx.state.halfSold = true;
      const halfQty = pos / 2;
      if (halfQty > 0) return { side: 'sell', qty: halfQty, reduceOnly: true };
    }
    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      ctx.state.halfSold = false;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (uptrend && macroOk) {
    ctx.watch([{ side: 'buy', price: lowerBand, trigger: 'below', note: 'BB lower + RSI<30' },
              { side: 'buy', price: keltnerLow, trigger: 'below', note: 'Keltner low + RSI<40' }]);
  }
  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;
  if (macroOk && bollingerFlush) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.state.halfSold = false;
    return { side: 'buy', qty: qty };
  }
  if (macroOk && keltnerPullback) {
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    ctx.state.halfSold = false;
    return { side: 'buy', qty: qty };
  }
  return null;
}
