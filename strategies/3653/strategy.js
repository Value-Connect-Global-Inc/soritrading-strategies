/*
 * @coinsori-strategy v1
 * name: DonchianDxyGate
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: crypto is a risk asset and trades against the US dollar
 * index. When the dollar is weak (DXY below its own 200-day average) capital
 * flows into risk, and BTC breakouts follow through; when the dollar is strong
 * the same breakouts stall. Gating the classic Turtle breakout on this macro
 * regime filters out breakouts that happen against the dollar tide.
 * When it buys and sells: buys full position when the previous close is a new
 * 55-day high AND the dollar index is below its 200-day average; sells on a
 * 20-day low or a hard 2x ATR stop below entry.
 * When it does NOT work: macro and crypto can decouple for long stretches, so
 * the gate can wrongly block or wrongly allow; in a sideways market breakouts
 * still whipsaw.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const entryHigh = ctx.high(55, 2); // 55-bar high, 2 bars back (excludes last closed bar)
  const exitLow = ctx.low(20, 2);    // 20-bar low, 2 bars back (excludes last closed bar)
  const atr = ctx.atr(14, 1);
  if (entryHigh == null || exitLow == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.position;

  if (pos > 0) {
    const hardStop = ctx.entryPx - 2 * atr;
    if (price <= hardStop || prevClose < exitLow) {
      ctx.watch([]);
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2x ATR stop' }]);
    return null;
  }

  // Macro regime gate: DXY below its own 200-day average = weak dollar = risk-on.
  // If the series is missing we pass (no gate) rather than block all entries.
  const dxy = ctx.macro('dxy');
  let gateOn = true;
  if (dxy != null && Number.isFinite(dxy)) {
    const st = ctx.state;
    if (!st.dxyBuf) st.dxyBuf = [];
    st.dxyBuf.push(dxy);
    if (st.dxyBuf.length > 200) st.dxyBuf.shift();
    if (st.dxyBuf.length >= 200) {
      const avg = st.dxyBuf.reduce((a, b) => a + b, 0) / st.dxyBuf.length;
      gateOn = dxy < avg; // weak dollar regime
    }
  }

  if (prevClose > entryHigh && gateOn) {
    ctx.watch([{ side: 'sell', price: ctx.entryPx - 2 * atr, trigger: 'below', note: '2x ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  ctx.watch([{ side: 'buy', price: entryHigh, trigger: 'above', note: '55d breakout entry' }]);
  return null;
}
