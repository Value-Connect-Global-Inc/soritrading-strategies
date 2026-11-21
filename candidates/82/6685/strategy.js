/*
 * @coinsori-strategy v1
 * name: BTC Donchian Breakout ATR Trail 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto trends on 4h charts tend to persist once a Donchian channel breaks, and a chandelier ATR stop rides the trend while cutting losers fast.
 * When it buys and sells: Goes long when the last closed bar closes above the 20-bar high (channel measured BEFORE that bar, so the breakout is real). Exits when price falls 3x ATR below the highest high since entry, or when it closes back below the 20-bar low.
 * When it does NOT work: In tight choppy ranges it gets whipsawed and fees eat the edge; in a strong one-direction melt-up it lags buy-and-hold.
 */
function onUpdate(ctx) {
  const n = 20;
  const len = ctx.closes.length;
  if (len < n + 3) { ctx.watch([]); return null; }

  // Donchian channel over the 20 CLOSED bars that end BEFORE the last closed bar (ago=2 window),
  // so the breakout close is compared against a level that was already in place — not its own high.
  let upper = -Infinity;
  let lower = Infinity;
  for (let i = len - 2 - n; i <= len - 3; i++) {
    const h = ctx.highs[i];
    const l = ctx.lows[i];
    if (h > upper) upper = h;
    if (l < lower) lower = l;
  }

  const atr = ctx.atr(14, 1);
  const prevClose = ctx.closes.at(-2);
  if (atr == null || prevClose == null) { ctx.watch([]); return null; }

  const pos = ctx.position;
  const st = ctx.state;

  if (pos > 0) {
    if (st.high == null) st.high = ctx.entryPx != null ? ctx.entryPx : prevClose;
    if (prevClose > st.high) st.high = prevClose;
    const mult = 3; // 3x ATR: wide enough to survive noise, tight enough to cut losers
    const stop = st.high - mult * atr;
    const watch = [
      { side: 'sell', price: stop, trigger: 'below', note: 'trailing stop' },
      { side: 'sell', price: lower, trigger: 'below', note: 'trend break exit' }
    ];
    if (prevClose < stop || prevClose < lower) {
      ctx.watch(watch);
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    ctx.watch(watch);
    return null;
  }

  // flat — only long entries (spot cannot short)
  st.high = null;
  const watch = [{ side: 'buy', price: upper, trigger: 'above', note: '20-bar breakout' }];
  if (prevClose > upper) {
    ctx.watch(watch);
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.99 };
  }
  ctx.watch(watch);
  return null;
}
