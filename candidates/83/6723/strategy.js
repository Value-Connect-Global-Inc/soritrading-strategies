/*
 * @coinsori-strategy v1
 * name: BTC Donchian Turtle Perp 4H
 * ex: binanceusdm
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Bitcoin trends hard in both directions. A classic
 * Donchian breakout (turtle) system on the perpetual catches those trends
 * long AND short, which is the only way to beat buy-and-hold in a falling
 * market. The channel is measured on closed bars only, so there is no
 * look-ahead.
 * When it buys and sells: it buys when price breaks above the highest high
 * of the last 120 bars (20 days) and shorts when price breaks below the
 * lowest low of the last 120 bars. It exits when price crosses back through
 * the 60-bar (10-day) opposite channel, and a wide 8x ATR stop is kept only
 * as catastrophic insurance against a fast gap.
 * When it does NOT work: in choppy sideways markets the breakouts whipsaw
 * and the small losses add up. Funding on the perpetual drags on returns
 * when price sits flat for long stretches.
 */
function onUpdate(ctx) {
  const px = ctx.price;
  const pos = ctx.position;
  const st = ctx.state;

  const ENTRY = 120;  // 4h*120 = 20 days — the classic turtle entry channel
  const EXIT = 60;    // 4h*60 = 10 days — classic turtle exit channel
  const STOP = 8;     // 8x ATR catastrophic stop only, wider than the 10-day channel
  const RISK = 0.015; // risk 1.5% of equity per trade — a bad streak cannot ruin the account

  const hiE = ctx.high(ENTRY, 1);
  const loE = ctx.low(ENTRY, 1);
  const atr = ctx.atr(14, 1);
  if (hiE == null || loE == null || atr == null) {
    ctx.watch([]);
    return null;
  }

  const allocOk = !ctx.alloc || ctx.alloc.status === 'ok'; // reduce-only mode: no new entries

  if (pos === 0) {
    ctx.watch([
      { side: 'buy', price: hiE, trigger: 'above', note: '20-day high breakout' },
      { side: 'sell', price: loE, trigger: 'below', note: '20-day low breakdown' }
    ]);
    if (!allocOk) return null;
    if (px > hiE) {
      const qty = (RISK * ctx.cash) / (STOP * atr);
      st.extreme = px;
      st.entryBar = ctx.i;
      return { side: 'buy', qty };
    }
    if (px < loE) {
      const qty = (RISK * ctx.cash) / (STOP * atr);
      st.extreme = px;
      st.entryBar = ctx.i;
      return { side: 'sell', qty };
    }
    return null;
  }

  // In a position: trail the anchor at the best price seen (closed bars only, no look-ahead)
  const long = pos > 0;
  const hiX = ctx.high(EXIT, 1);
  const loX = ctx.low(EXIT, 1);
  const hi = ctx.highs.at(-2);
  const lo = ctx.lows.at(-2);
  let extreme = st.extreme != null ? st.extreme : px;
  extreme = long ? Math.max(extreme, hi) : Math.min(extreme, lo);
  st.extreme = extreme;

  const chanExit = long ? loX : hiX;                       // opposite channel exit
  const hardStop = long ? extreme - STOP * atr : extreme + STOP * atr;
  const hitChan = long ? px < chanExit : px > chanExit;
  const hitStop = long ? px < hardStop : px > hardStop;

  ctx.watch(long
    ? [{ side: 'sell', price: chanExit, trigger: 'below', note: '10-day channel exit' },
       { side: 'sell', price: hardStop, trigger: 'below', note: 'ATR catastrophe stop' }]
    : [{ side: 'buy', price: chanExit, trigger: 'above', note: '10-day channel exit' },
       { side: 'buy', price: hardStop, trigger: 'above', note: 'ATR catastrophe stop' }]);

  if (hitChan || hitStop) {
    st.extreme = null;
    return { side: long ? 'sell' : 'buy', qty: Math.abs(pos), reduceOnly: true };
  }
  return null;
}
