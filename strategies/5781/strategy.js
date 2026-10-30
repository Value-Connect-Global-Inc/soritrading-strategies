/*
 * @coinsori-strategy v1
 * name: MultiAsset OnChain-Gated MR 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, XRP/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The 5-asset defensive mean-reversion basket is this job's validated champion.
 * This version adds an ON-CHAIN adoption gate: it only takes mean-reversion dips when Bitcoin's
 * active-address count is expanding (network usage growing). The idea is that dips during genuine
 * adoption growth are more likely to recover than dips during network decline. This is a different
 * information source (on-chain usage) layered on the proven structure.
 * When it buys and sells: On each asset, buy when price closes below the lower Bollinger (20,2.5)
 * with RSI<30, or below the ATR-adaptive Keltner low with RSI<40, only when the 200-day average is
 * rising AND BTC active addresses are expanding. Sell via an ATR-trailing stop (2.5 ATR below the
 * peak) or when price closes back above the 20-day EMA.
 * When it does NOT work: In a broad coordinated crypto bear all rising-trend gates stay flat
 * (capital safe, little upside); a single straight-line melt-up lags buy-and-hold of that asset.
 * If the adoption gate is too strict it may sit out recoveries that happen before addresses catch up.
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

  // On-chain adoption gate: BTC active addresses expanding (daily value above its 30-day lookback).
  const addr30 = ctx.data('addr_sma30'); // 30-day avg of daily active addresses
  if (addr30 == null) return null;
  const hist = ctx.state.addrHist || [];
  if (hist.length === 0 || hist[hist.length - 1] !== addr30) {
    hist.push(addr30);
    if (hist.length > 40) hist.shift();
  }
  ctx.state.addrHist = hist;
  if (hist.length < 31) return null;
  const adoptionRising = addr30 > hist[hist.length - 31];
  if (!adoptionRising) return null;

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
