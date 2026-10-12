/*
 * @coinsori-strategy v1
 * name: SOL On-Chain Demand Breakout 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin active addresses are a direct demand proxy for
 *   the whole crypto market — when network usage grows, breakouts are real;
 *   when it shrinks, they fail. The champion's breakout entry already works;
 *   this adds a Bitcoin on-chain demand confirmation on top. Different axis
 *   from price/sentiment: fundamental network activity.
 * When it buys and sells: buy when BTC active addresses are above their 30-day
 *   average, price is above its 100-EMA and makes a fresh 20-bar high, with
 *   Fear&Greed < 75; sell on a 20-bar low close or a 2.5x ATR hard stop.
 * When it does NOT work: active addresses can stay high during a crypto crash
 *   (people still transacting), so it is not a complete shield; a pure price
 *   trend that runs on low network activity is missed. Daily data updates
 *   slowly, so it reacts late.
 */
function onUpdate(ctx) {
  const fg = ctx.data('fg');
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  if (atr == null || ema100 == null) return null;

  const price = ctx.price;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  if (ctx.position > 0) {
    const hardStop = ctx.entryPx - 2.5 * atr;
    const ll20 = ctx.low(20, 2);
    if (price <= hardStop) return { side: 'sell', qty: ctx.position };
    if (ll20 != null && prevClose <= ll20) return { side: 'sell', qty: ctx.position };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR hard stop' },
               { side: 'sell', price: ll20, trigger: 'below', note: '20-bar channel exit' }]);
    return null;
  }

  if (fg != null && fg >= 75) return null;      // blow-off top blocks entry (fg null = skip gate)
  if (addr != null && addrSma != null && addr <= addrSma) return null;  // shrinking BTC usage = no long
  if (prevClose <= ema100) return null;         // only buy in an uptrend
  const hh20 = ctx.high(20, 2);
  if (hh20 == null || prevClose <= hh20) return null;   // enter only on a FRESH breakout

  // risk 2% of cash on a 2.5x ATR stop, capped by available cash
  const riskCash = ctx.cash * 0.02;
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash * 0.99) / price;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
