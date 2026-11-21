/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Crash Exit 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin bull trends are best ridden on price alone, but on-chain usage can warn of a real exodus: when daily active addresses collapse well below their recent average, the rally is losing its user base and a deeper drawdown often follows. So we ride the EMA50 trend and add on-chain usage collapse as an early exit warning.
 * When it buys and sells: buys when the daily close is above its 50-day EMA. Sells when the close drops below the 50-day EMA, when yesterday's active-address count falls to 5% below its 30-day average (usage collapse), or when a capped trailing stop (3x ATR, max 20% below the highest close since entry) is hit.
 * When it does NOT work: in a long sideways market the EMA crosses repeatedly and the strategy pays fees with no trend; if price keeps rising while addresses fall (a liquidity-driven melt-up), the usage exit sells too early and misses the top; address data is reported with a delay so the exit can be late.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const ema50_1 = ctx.ema(50, 1);
  const atr1 = ctx.atr(14, 1);
  const addr = ctx.data('addr');
  if (price == null || ema50_1 == null || atr1 == null || atr1 <= 0 || addr == null) {
    ctx.watch([]);
    return null;
  }

  // Rolling active-address history; only the PREVIOUS day's value is used (arr.at(-2)).
  const arr = ctx.state.addrArr || [];
  arr.push(addr);
  if (arr.length > 31) arr.shift();
  ctx.state.addrArr = arr;
  if (arr.length < 31) { ctx.watch([]); return null; }
  const prevAddr = arr.at(-2);
  const win = arr.slice(-31, -1);              // the 30 days ending at prevAddr
  const sma30 = win.reduce((a, b) => a + b, 0) / 30;
  if (sma30 <= 0) { ctx.watch([]); return null; }
  const ratio = prevAddr / sma30;              // >1 = usage expanding, <1 = contracting

  const close1 = ctx.closes.at(-2);
  if (close1 == null) { ctx.watch([]); return null; }
  const pos = ctx.position;
  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok';

  if (pos > 0) {
    const highSince = ctx.state.highSince || close1;
    const newHigh = Math.max(highSince, close1);
    ctx.state.highSince = newHigh;
    // Trailing stop: 3x ATR below the highest close since entry, capped at 20%.
    const stop = Math.max(newHigh - 3 * atr1, newHigh * 0.80);
    const trendBroken = close1 < ema50_1;
    const usageCollapse = ratio < 0.95;        // 5% below 30-day mean = real exodus
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: ema50_1, trigger: 'below', note: 'EMA50 break' },
               { side: 'sell', price: ema50_1, trigger: 'below', note: 'usage exit', conds: [{ label: 'addr ratio', now: ratio, op: '<', ref: 0.95, closed: true }] }]);
    if (close1 < stop || trendBroken || usageCollapse) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const uptrend = close1 > ema50_1;
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long trend', conds: [{ label: 'close > EMA50', ok: uptrend }] }]);
  if (allocOk && uptrend) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
