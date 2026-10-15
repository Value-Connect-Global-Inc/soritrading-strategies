/*
 * @coinsori-strategy v1
 * name: Fed-Regime Hashtrend BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends are most reliable when the Fed's policy rate
 * is low (cheap money, abundant risk appetite) and least reliable when rates are
 * high (tight liquidity). This adds the Fed funds rate as a regime filter on top
 * of a proven on-chain trend confirmation. The bet: the same price+hashrate
 * trend is worth more in a low-rate regime and less in a high-rate one.
 * When it buys and sells: buys when the previous close is above the 50-day EMA,
 * the hash rate is above its 30-day average, AND the Fed funds rate is below a
 * high-rate ceiling. Sells when price closes below the 50-day EMA or a 2.5x ATR
 * hard stop is hit. Positions risk 4% of cash per trade.
 * When it does NOT work: the Fed rate is a slow-moving level that changes only
 * at policy decisions, so it rarely flips — in a regime where the rate sits at
 * the ceiling for years (e.g. the 2022-23 hiking cycle) the strategy stays in
 * cash and misses a large part of the eventual recovery. It is trend-following
 * and does not profit from range-bound price action.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema50 = ctx.ema(50, 1);
  const atr = ctx.atr(14, 1);
  if (ema50 == null || atr == null || atr <= 0) return null;

  // Mining health: hash rate vs its 30-day average
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const hrVal = hr == null ? null : Number(hr);
  const hrAvg = hrSma == null ? null : Number(hrSma);
  const miningUp = (hrVal != null && hrAvg != null && Number.isFinite(hrVal) && Number.isFinite(hrAvg) && hrAvg > 0 && hrVal > hrAvg);

  // Fed regime: the fed funds rate, in percent
  const fedRaw = ctx.data('fed');
  const fed = fedRaw == null ? null : Number(fedRaw);
  // High-rate ceiling: above this the trend is treated as unreliable.
  // 4% chosen because it separates the 2022-23 tightening cycle (rates ~4-5%)
  // from the low-rate 2017-21 era and the post-2024 easing (~0-4%). Not tuned.
  const HIGH_RATE = 4.0;
  const lowRate = (fed != null && Number.isFinite(fed) && fed < HIGH_RATE);

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx - 2.5 * atr;   // hard stop: 2.5x daily ATR below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    const prevClose = ctx.closes.at(-2);
    if (prevClose != null && prevClose < ema50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema50, trigger: 'below', note: '50-day trend break' }]);
    return null;
  }

  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;
  const uptrend = prevClose > ema50;
  ctx.watch([{ side: 'buy', price: ema50, trigger: 'above', note: 'close above 50-day EMA',
               conds: [{ label: 'close > 50-EMA', ok: uptrend, closed: true },
                       { label: 'hashrate > 30d avg', ok: miningUp, closed: true },
                       { label: 'fed rate < 4%', ok: lowRate, closed: true }] }]);
  if (!uptrend || !miningUp || !lowRate) return null;

  const riskCash = ctx.cash * 0.04;         // risk 4% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
