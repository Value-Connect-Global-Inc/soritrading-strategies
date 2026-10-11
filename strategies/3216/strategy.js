/*
 * @coinsori-strategy v1
 * name: XRP 4H Donchian Breakout
 * ex: binance
 * syms: XRPUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: crypto trends are long and violent once they start. Buying a fresh
 * 20-bar high breakout and riding it until price breaks the 10-bar low catches the big
 * sustained moves and lets winners run instead of cutting them short.
 * When it buys and sells: buy when price closes above the highest high of the last 20 bars.
 * Sell when price closes below the lowest low of the last 10 bars, or if price drops more
 * than 3 ATR below the entry (crash protection).
 * When it does NOT work: in long sideways chop the breakout fails and the stop is hit
 * repeatedly (small losses); this strategy makes its money on the few big trends and
 * loses slowly in ranging markets. It does not protect you in a fast crash beyond the stop.
 *
 * (2026-04-09) 표시만 바뀜, 매매 판단은 그대로
 */

function onUpdate(ctx) {
  const hi20 = ctx.high(20, 1); // highest high of last 20 CLOSED bars
  const lo10 = ctx.low(10, 1);  // lowest low of last 10 CLOSED bars
  if (hi20 == null || lo10 == null) return null;

  const st = ctx.state || {};

  // ---- exit ----
  if (ctx.position > 0) {
    const crashStop = st.entryPx != null ? st.entryPx - 3 * (ctx.atr(14, 1) || 0) : -Infinity;
    ctx.watch([
      { side: 'sell', price: lo10, trigger: 'below', note: '10-bar low trail' },
      { side: 'sell', price: crashStop, trigger: 'below', note: '3 ATR crash stop' }
    ]);
    if (ctx.price < lo10 || ctx.price < crashStop) {
      return { side: 'sell', qty: ctx.position };
    }
    return null;
  }

  // ---- entry wait: fresh 20-bar high breakout ----
  ctx.watch([{ side: 'buy', price: hi20, trigger: 'above', note: '20-bar high breakout' }]);

  if (ctx.price > hi20) {
    ctx.state = { entryPx: ctx.price };
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.98 };
  }
  return null;
}
