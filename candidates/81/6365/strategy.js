/*
 * @coinsori-strategy v1
 * name: ETH 1h EMA-trend pullback ATR stop
 * ex: binance
 * syms: ETH/USDT
 * interval: 1h
 * cash: 1000
 *
 * Why this strategy: In a clear uptrend (price above a rising 200-period EMA) pullbacks to weakness (RSI oversold) tend to resume, so buying the dip with a hard ATR stop cuts losers fast and lets winners run.
 * When it buys and sells: It buys when the 1h price is above a rising EMA200, RSI(14) is below 40 and price has pulled back under EMA20. It sells when price falls to an ATR trailing stop or reaches a take-profit.
 * When it does NOT work: In choppy sideways markets the EMA filter whipsaws and pullback entries keep hitting the stop; in a sustained bear market the EMA200 filter keeps it out most of the time but the few entries still lose.
 */
function onUpdate(ctx) {
  const ema20 = ctx.ema(20, 1);
  const ema200 = ctx.ema(200, 1);
  const ema200Prev = ctx.ema(200, 2);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || ema200 == null || ema200Prev == null || atr == null || rsi == null) return null;

  const price = ctx.price;
  const pos = ctx.position;
  const stopDist = 2.5 * atr; // 2.5x ATR filters normal noise but still cuts losers fast
  const tpDist = 5 * atr;     // take profit at 2x the stop distance so winners pay for losers

  if (pos <= 0) {
    const uptrend = price > ema200 && ema200 > ema200Prev;
    const pullback = price < ema20 && rsi < 40;
    ctx.watch([{
      side: 'buy',
      price: ema20,
      trigger: 'below',
      note: 'pullback below EMA20',
      conds: [
        { label: 'RSI(14) < 40', now: rsi, op: '<', ref: 40, closed: true },
        { label: 'price above EMA200', ok: price > ema200 },
        { label: 'EMA200 rising', ok: ema200 > ema200Prev }
      ]
    }]);
    if (!uptrend || !pullback) return null;
    const riskQty = (ctx.cash * 0.01) / stopDist; // aim to risk ~1% of cash per trade
    const maxQty = (ctx.cash * 0.95) / price;
    const qty = Math.min(riskQty, maxQty);
    if (qty <= 0) return null;
    ctx.state.stop = price - stopDist;
    ctx.state.peak = price;
    return { side: 'buy', qty };
  }

  const entry = ctx.entryPx;
  if (entry == null) return null;
  let stop = ctx.state.stop != null ? ctx.state.stop : entry - stopDist;
  let peak = ctx.state.peak != null ? ctx.state.peak : entry;
  if (price > peak) peak = price;
  const newStop = peak - stopDist;
  if (newStop > stop) stop = newStop;
  const tp = entry + tpDist;
  ctx.state.stop = stop;
  ctx.state.peak = peak;

  ctx.watch([
    { side: 'sell', price: stop, trigger: 'below', note: 'ATR trailing stop' },
    { side: 'sell', price: tp, trigger: 'above', note: 'take profit' }
  ]);

  if (price <= stop || price >= tp) {
    return { side: 'sell', qty: pos, reduceOnly: true };
  }
  return null;
}
