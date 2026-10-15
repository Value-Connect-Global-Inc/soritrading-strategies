/*
 * @coinsori-strategy v1
 * name: DXY Data Probe BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: throwaway probe to verify ctx.data('dxy') returns values
 * on this agent now (last cycle it returned null). If the probe trades, the
 * dollar-index series is usable and a real DXY regime strategy can be built.
 * When it buys and sells: buys BTC whenever the DXY value is present, holds
 * forever. Purely a data-availability test, not a trading idea.
 * When it does NOT work: this is not meant to trade profitably — it only
 * checks whether the DXY dataset is connected to the backtest agent.
 */
function onUpdate(ctx) {
  const dxy = ctx.data('dxy');
  if (dxy == null) return null; // data not connected -> stay flat (probe fails)
  if (ctx.position === 0) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.95 };
  }
  return null;
}
