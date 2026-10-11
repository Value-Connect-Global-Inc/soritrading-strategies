/*
 * @coinsori-strategy v1
 * name: ADA Donchian 55/10 VolTarget 1D
 * ex: binance
 * syms: ADAUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The ADA Donchian 55/10 champion beats buy-and-hold on all three 1d windows,
 * but its losses come from breakout whipsaws in volatile bear markets. This variant keeps the
 * same entry and exit rules and only changes SIZE: position size shrinks when volatility rises,
 * so every trade risks roughly the same dollar amount regardless of market conditions (classic
 * inverse-volatility risk targeting). In calm conditions it trades at full size and keeps the
 * bull gains; in high-volatility conditions it bets less, so a whipsaw costs less.
 * When it buys and sells: Buys when a closed bar closes above the highest 55 bars. Sells when a
 * closed bar closes below the lowest 10 bars, or price falls 2x ATR below entry. Size = the
 * 100-day average ATR divided by today's ATR, capped between 0.25 and 1.0.
 * When it does NOT work: In a long range where every breakout is a trap it still loses, just less.
 * A violent crash gaps through the ATR stop regardless of size. In a bull run where volatility
 * keeps rising it sizes down and captures less of the rally than full-size would.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const closes = ctx.closes;
  const n = closes.length;
  if (n < 60) return null;

  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  // Vol-target sizing: size = long-run ATR / current ATR. High volatility shrinks the bet so each
  // trade risks similar dollars. Reference = average of the last 100 closed ATR values.
  let refAtr = 0, count = 0;
  for (let k = 1; k <= 100; k++) {
    const a = ctx.atr(14, k);
    if (a != null) { refAtr += a; count++; }
  }
  let sizeMult = 1.0;
  if (count > 0 && refAtr > 0) {
    // floor 0.25 (still participate in the trade), cap 1.0 (never lever up) — risk rule, not tuned
    sizeMult = Math.min(1.0, Math.max(0.25, refAtr / count / atr));
  }

  const pos = ctx.position;

  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2 * atr;
    const channelLow = Math.min(...closes.slice(-12, -2));
    const exited = prevClose < channelLow || price < stop;
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2 ATR stop' }]);
    if (exited) {
      ctx.state.coolUntil = ctx.i + 3;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  const channelHigh = Math.max(...closes.slice(-57, -2));
  const breakout = prevClose > channelHigh;
  if (breakout && ctx.i >= (ctx.state.coolUntil || 0)) {
    ctx.watch([{ side: 'sell', price: price - 2 * atr, trigger: 'below', note: '2 ATR stop' }]);
    return { side: 'buy', qty: ((ctx.cash / price) * 0.99 * sizeMult) };
  }
  return null;
}
