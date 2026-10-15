/*
 * @coinsori-strategy v1
 * name: VolTarget AlwaysIn (re-baseline)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC trends up over the long run but with violent volatility
 *   spikes. Instead of trying to predict WHEN a crash starts (which whipsaws and
 *   loses money), it stays invested and simply holds a smaller position when
 *   volatility is high.
 * When it buys and sells: Always holds BTC. Each day it measures volatility
 *   (ATR/price) and sets its position size so that the portfolio's daily swing
 *   stays near a target. High volatility -> small position, low volatility ->
 *   full position. It only trades when the position needs a meaningful adjustment.
 * When it does NOT work: It is still long in a long bear market, so it loses money -
 *   just less than holding everything. The risk target caps how much it can make in
 *   a calm bull run (it never uses leverage). Fees on rebalancing eat returns if
 *   vol jumps around a lot.
 */
function onUpdate(ctx) {
  const atr = ctx.atr(30, 1); // slower vol estimate: fewer rebalances, less fee drag
  if (atr == null) return null;
  const price = ctx.price;

  const equity = ctx.cash + ctx.position * price;
  const dailyVol = atr / price;

  const targetVol = 0.02; // keep portfolio daily swing near 2% of equity
  let frac = targetVol / dailyVol;
  if (frac > 1) frac = 1;   // never leverage, cap at 1x
  if (frac < 0.15) frac = 0.15; // never fully exit: stay in the market

  const targetQty = equity * frac / price;
  const curQty = ctx.position;
  const diff = targetQty - curQty;

  // deadband: only rebalance when the gap is >15% of current position, to cut fees
  if (curQty > 0 && Math.abs(diff) < curQty * 0.15) return null;

  if (diff > 0) return { side: 'buy', qty: diff };
  return { side: 'sell', qty: -diff };
}
