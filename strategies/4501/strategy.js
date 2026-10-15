/*
 * @coinsori-strategy v1
 * name: VolTarget TrendGate BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trends up over the long run but with violent volatility spikes
 *   and long bear markets. Volatility targeting alone reduces daily swing but still rides
 *   a slow grind-down at full size. A mild trend gate (price vs 200-day average) trims
 *   exposure in a bear regime while keeping enough on to catch the recovery.
 * When it buys and sells: Always holds some BTC. Each day it sets position size so daily
 *   swing stays near 2% (vol targeting). If price is below its 200-day average, exposure
 *   is capped at 60% (mild bear trim). It only trades when the position needs a meaningful
 *   change, to limit fees.
 * When it does NOT work: It is still long in a long bear market (capped at 60%, not zero),
 *   so it still loses money there. The 200-day gate re-enters late after a recovery starts.
 *   Fees on rebalancing eat returns if vol jumps around.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || sma200 == null) return null;
  const price = ctx.price;

  const equity = ctx.cash + ctx.position * price;
  const dailyVol = atr / price; // realized daily volatility

  const targetVol = 0.02; // keep portfolio daily swing near 2% of equity
  let frac = targetVol / dailyVol;
  if (frac > 1) frac = 1;
  if (frac < 0.15) frac = 0.15;

  // mild bear trim: cap at 60% (not 30%) below the 200-day to keep recovery upside
  if (price < sma200 && frac > 0.6) frac = 0.6;

  const targetQty = equity * frac / price;
  const curQty = ctx.position;
  const diff = targetQty - curQty;

  // deadband: only rebalance when the gap is >15% of current position, to cut fees
  if (curQty > 0 && Math.abs(diff) < curQty * 0.15) return null;

  if (diff > 0) return { side: 'buy', qty: diff };
  return { side: 'sell', qty: -diff };
}
