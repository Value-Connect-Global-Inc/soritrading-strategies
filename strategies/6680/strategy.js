/*
 * @coinsori-strategy v1
 * name: BTC On-Chain Regime Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin price tends to follow network adoption — when the number of daily active on-chain addresses is growing, bull trends are usually healthy; when usage is flat or contracting, rallies often fail. We use on-chain activity as a confirmation layer on top of a simple trend rule.
 * When it buys and sells: buys when the daily close is above its 50-day EMA AND yesterday's active-address count is at least 3% above its own 30-day average (usage clearly expanding). Sells when the close drops below the 50-day EMA, when usage contracts to 3% below its 30-day average, or when a capped trailing stop (3x ATR, max 20% below the highest close since entry) is hit.
 * When it does NOT work: in a long sideways market the EMA and address filters flip on and off and the strategy pays fees with no trend; address data is reported with a delay so entries can be late; if adoption keeps growing while price crashes (a leverage unwind), the on-chain filter will not protect you.
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

  // Rolling active-address history. We only ever use the PREVIOUS day's value
  // (arr.at(-2)) so the decision never depends on a half-finished today.
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
    // Trailing stop: 3x ATR below the highest close since entry, capped at 20%
    // below it so a vol spike cannot widen it into a slow bleed.
    const stop = Math.max(newHigh - 3 * atr1, newHigh * 0.80);
    const trendBroken = close1 < ema50_1;
    const usageBroken = ratio < 0.97;          // on-chain usage contracting
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
               { side: 'sell', price: ema50_1, trigger: 'below', note: 'EMA50 break' },
               { side: 'sell', price: ema50_1, trigger: 'below', note: 'usage exit', conds: [{ label: 'addr ratio', now: ratio, op: '<', ref: 0.97, closed: true }] }]);
    if (close1 < stop || trendBroken || usageBroken) {
      ctx.state.highSince = 0;
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  const uptrend = close1 > ema50_1;
  const usageUp = ratio > 1.03;                // 3% above 30-day mean = clear expansion
  ctx.watch([{ side: 'buy', price: ema50_1, trigger: 'above', note: 'long trend', conds: [
    { label: 'addr ratio', now: ratio, op: '>', ref: 1.03, closed: true },
    { label: 'close > EMA50', ok: uptrend } ] }]);
  if (allocOk && uptrend && usageUp) {
    ctx.state.highSince = close1;
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
