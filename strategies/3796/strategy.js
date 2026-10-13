/*
 * @coinsori-strategy v1
 * name: VolTarget BTC Rider
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin's risk (volatility) swings wildly. Instead of predicting direction, this sizes exposure so that expected daily volatility stays near a fixed target — full position in calm markets, small position in storms. The bet is that volatility clusters, so today's level is a useful guide to tomorrow's.
 * When it buys and sells: Rebalances every 7 days. Target position = (targetVol / realizedVol) * equity, capped at 100%. If realized vol (ATR/price) is low, it holds ~all BTC; if vol spikes, it cuts to a fraction or cash. A hard 25% stop below entry exits everything as tail protection.
 * When it does NOT work: In a slow grinding bear with moderate vol (e.g. 2022), it keeps a large position and bleeds like buy-and-hold. In a fast bull it underperforms full buy-and-hold because it is never 100% exposed after any vol spike. It is a risk-shaper, not an alpha finder — its job is smaller drawdowns, not bigger returns.
 */
function onUpdate(ctx) {
  // Use closed-bar ATR and price so live/backtest/paper all agree.
  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  if (atr == null || prevClose == null || prevClose <= 0) return null;

  const realizedVol = atr / prevClose;
  const targetVol = 0.015; // 1.5% daily ~ 24% annualized — a moderate, survivable risk budget
  let exposure = Math.min(1, targetVol / realizedVol); // cap at 100% long

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
