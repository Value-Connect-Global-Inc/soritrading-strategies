/*
 * @coinsori-strategy v1
 * name: VolTarget BTC Rider
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's risk (volatility) swings wildly. Instead of predicting direction, this sizes exposure so that expected daily volatility stays near a fixed target — full position in calm markets, small position in storms. A trend gate on top means we only hold long when the medium-term trend is up, so we do not bleed in slow low-vol bears.
 * When it buys and sells: Only holds BTC when EMA50 > EMA200 (uptrend). Size = (targetVol / realizedVol) * equity, capped at 100%, rebalanced every 7 days. If realized vol (ATR/price) is low it holds ~all BTC; if vol spikes it cuts to a fraction or cash. A hard 25% stop below entry exits everything as tail protection.
 * When it does NOT work: In a fast bull it underperforms full buy-and-hold because it is never 100% exposed after any vol spike. In a choppy sideways market the trend gate flips on and off, causing whipsaws and fee drag. It is a risk-shaper, not an alpha finder — its job is smaller drawdowns, not bigger returns.
 */
function onUpdate(ctx) {
  // Closed-bar values so live/backtest/paper all agree.
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  const ema50 = ctx.ema(50, 1);
  const ema200 = ctx.ema(200, 1);
  if (atr == null || prevClose == null || prevClose <= 0 || ema50 == null || ema200 == null) return null;

  const uptrend = ema50 > ema200; // trend gate: only long in a rising medium-term trend
  const realizedVol = atr / prevClose;
  const targetVol = 0.015; // 1.5% daily ~ 24% annualized — a moderate, survivable risk budget
  let exposure = uptrend ? Math.min(1, targetVol / realizedVol) : 0; // in downtrend hold cash

  // Disaster stop: 25% below entry, wide enough not to trigger on normal 1d swings.
  if (ctx.position > 0 && ctx.entryPx != null) {
    const stop = ctx.entryPx * 0.75;
    const watch = [{ side: 'sell', price: stop, trigger: 'below', note: '25% disaster stop' }];
    if (ctx.price <= stop) {
      ctx.watch(watch);
      return { side: 'sell', qty: ctx.position };
    }
  }

  // Rebalance weekly (every 7 bars) to keep fees low on 1d.
  if (ctx.i % 7 !== 0) {
    if (ctx.position > 0 && ctx.entryPx != null) {
      ctx.watch([{ side: 'sell', price: ctx.entryPx * 0.75, trigger: 'below', note: '25% disaster stop' }]);
    }
    return null;
  }

  const equity = ctx.cash + ctx.position * ctx.price;
  const targetQty = (equity * exposure) / ctx.price;
  const diff = targetQty - ctx.position;
  if (diff > 0.0005) {
    ctx.watch([{ side: 'buy', price: ctx.price, trigger: 'below', note: 'vol-target buy' }]);
    return { side: 'buy', qty: diff };
  }
  if (diff < -0.0005) {
    ctx.watch([{ side: 'sell', price: ctx.price, trigger: 'above', note: 'vol-target trim' }]);
    return { side: 'sell', qty: -diff };
  }
  ctx.watch([{ side: 'sell', price: ctx.entryPx != null ? ctx.entryPx * 0.75 : ctx.price, trigger: 'below', note: '25% disaster stop' }]);
  return null;
}
