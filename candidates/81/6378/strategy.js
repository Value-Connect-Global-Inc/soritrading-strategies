/*
 * @coinsori-strategy v1
 * name: ETH ATR-Calm Trend Ride 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: in crypto, uptrends that begin from a CALM (low-volatility) period tend to
 * persist longer and give cleaner entries than breakouts from a volatile chop, and calm entries
 * rarely hit an immediate stop. We ride the trend while it holds and step out when it breaks.
 * When it buys and sells: Buys when the last closed price is above its 200-bar average (uptrend)
 * AND volatility (ATR-14) is below its own 100-bar average (calm regime). Sells when the close
 * drops back below the 200-bar average, or on a 2.5x-ATR stop if the trade turns against us.
 * When it does NOT work: in a long sideways chop the 200-bar filter whipsaws and fees accumulate;
 * in a slow grind-down the calm filter delays entries but the 200-bar exit is still late.
 */
const TREND = 200;     // long-term trend filter (4h bars)
const ATR_N = 14;      // volatility measure
const ATR_LOOK = 100;  // how many bars of ATR history form the "calm" reference
const STOP_MULT = 2.5; // stop distance in ATR units from entry

function onUpdate(ctx) {
  const sma = ctx.sma(TREND, 1);
  const atr = ctx.atr(ATR_N, 1);
  if (sma == null || atr == null) return null;

  // "calm" reference = average ATR over the last 100 CLOSED bars
  let sum = 0, cnt = 0;
  for (let i = 1; i <= ATR_LOOK; i++) {
    const a = ctx.atr(ATR_N, i);
    if (a == null) break;
    sum += a; cnt++;
  }
  if (cnt < 30) return null;
  const atrAvg = sum / cnt;
  const calm = atr < atrAvg;

  const prevClose = ctx.closes.at(-2); // last closed bar
  const price = ctx.price;
  const stop = ctx.entryPx != null ? ctx.entryPx - STOP_MULT * atr : null;

  const watch = [
    { side: 'buy', price: sma, trigger: 'above', note: 'uptrend', conds: [{ label: 'calm ATR', ok: calm }] },
    { side: 'sell', price: sma, trigger: 'below', note: 'trend break' }
  ];
  if (stop != null) watch.push({ side: 'sell', price: stop, trigger: 'below', note: 'ATR stop' });
  ctx.watch(watch);

  if (ctx.position > 0) {
    if (prevClose < sma || (stop != null && price <= stop)) {
      return { side: 'sell', qty: ctx.position, reduceOnly: true };
    }
    return null;
  }
  if (prevClose > sma && calm) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
