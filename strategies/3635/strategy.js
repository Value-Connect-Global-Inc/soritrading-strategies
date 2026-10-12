/*
 * @coinsori-strategy v1
 * name: Multi-Asset Trend-Pullback 4H
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin's long-term trend (200-period average) filters
 *   the short-term 20-bar breakout engine. Only breakouts that happen inside
 *   a confirmed long-term uptrend (price above its 200-SMA) are taken; the
 *   rest are likely false moves in a downtrend. The same engine was validated
 *   on BTC and also showed a positive edge on ETH and SOL, so it now runs on
 *   all three as a basket — a pullback on any one asset can trigger a trade
 *   instead of the whole account waiting on BTC.
 * When it buys and sells: on each asset, buy a 20-bar high close above the
 *   100-EMA only when price is also above its 200-SMA (long-term uptrend) and
 *   volume is above its 20-bar average. Sell on a 20-bar low close, a 2.5x ATR
 *   hard stop, or a close back below the 100-EMA.
 * When it does NOT work: it misses the early recovery of a new bull market
 *   (price still below the 200-SMA at the bottom) and sits out strong
 *   counter-trend rallies in bear markets. Each leg is capped at 30% of cash,
 *   so it never concentrates the account in one asset.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || ema100 == null || sma200 == null) return null;
  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: pos };
    if (prevClose < ema100) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' },
               { side: 'sell', price: ema100, trigger: 'below', note: '100-EMA trend break' }]);
    return null;
  }

  if (prevClose < sma200) return null;   // long-term trend filter: only buy in an uptrend
  if (prevClose <= ema100) return null;
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;
  const volPrev = ctx.volPrev;
  const avgVol = ctx.avgVol(20);
  if (volPrev == null || avgVol == null || avgVol <= 0) return null;
  if (volPrev < avgVol) return null;

  // per-asset risk budget: 1/3 of the 2% risk so the whole basket risks ~2% (3 assets)
  const riskCash = (ctx.cash * 0.02) / 3;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.30) / price;   // cap each leg at 30% of cash — no single-asset concentration
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
