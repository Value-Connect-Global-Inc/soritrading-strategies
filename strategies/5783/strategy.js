/*
 * @coinsori-strategy v1
 * name: MultiAsset OnChain-Mild MR 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The strict on-chain gate (addresses strictly rising) cut return too much —
 * it sat out recoveries that began before addresses caught up. This version uses a MILD adoption
 * filter: it only blocks mean-reversion dips when Bitcoin's active addresses are near their
 * 90-day low, i.e. clear network decay. Normal dips in stable or growing adoption pass through,
 * keeping the champion's participation while filtering the worst on-chain deterioration.
 * When it buys and sells: On each asset, buy when price closes below the lower Bollinger (20,2.5)
 * with RSI<30, or below the ATR-adaptive Keltner low with RSI<40, only when the 200-day average is
 * rising AND BTC active addresses are above their 90-day low. Sell via an ATR-trailing stop (2.5
 * ATR below the peak) or when price closes back above the 20-day EMA.
 * When it does NOT work: In a broad coordinated crypto bear all rising-trend gates stay flat; a
 * single straight-line melt-up lags buy-and-hold of that asset. Network decay can lag a price
 * bottom, so the mild gate may still let a few falling-knife dips through.
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

  const uptrend = sma200 > sma200prev;
  const lowerBand = bb.lower;
  const keltnerLow = ema20 - 2.5 * atr;

  const pos = ctx.pos(sym);
  if (pos > 0) {
    const peak = ctx.state.peak != null ? Math.max(ctx.state.peak, price) : price;
    ctx.state.peak = peak;
    const trailStop = peak - 2.5 * atr;
    if (price < trailStop || price > ema20) {
      ctx.state.peak = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  if (!uptrend) return null;

  // Mild adoption gate: block only when addresses are near their 90-day low (clear decay).
  const addr30 = ctx.data('addr_sma30');
  if (addr30 == null) return null;
  const hist = ctx.state.addrHist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== addr30) {
    hist.push(addr30);
    if (hist.length > 91) hist.shift();
  }
  ctx.state.addrHist = hist;
  if (hist.length < 90) return null;
  const min90 = Math.min.apply(null, hist.slice(0, 90));
  const nearLow = addr30 <= min90 * 1.02; // within 2% of the 90-day low = decay, block
  if (nearLow) return null;

  const bollingerFlush = price < lowerBand && rsi < 30;
  const keltnerPullback = price < keltnerLow && rsi < 40;

  if (bollingerFlush) {
    const qty = (ctx.cash / price) * 0.20;
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  if (keltnerPullback) {
    const riskBudget = 0.025 * ctx.cash;
    let qty = riskBudget / atr;
    const maxQty = (ctx.cash / price) * 0.20;
    qty = Math.min(qty, maxQty);
    if (qty <= 0) return null;
    ctx.state.peak = price;
    return { side: 'buy', qty: qty };
  }
  return null;
}
