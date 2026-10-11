/*
 * @coinsori-strategy v1
 * name: BTC Ichimoku Cloud Trend 1D
 * ex: binance
 * syms: BTCUSDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Ichimoku Cloud is a genuinely different trend signal family
 * (Tenkan/Kijun cross + cloud filter) that was saved twice in this job but never
 * actually backtested. It measures trend by the position of price relative to a
 * cloud of prior highs/lows rather than a single moving average — a different
 * failure mode than the Donchian champion, so it diversifies the account.
 * When it buys and sells: buys when the Tenkan (9-bar mid) crosses ABOVE the Kijun
 * (26-bar mid) on a closed bar AND price closes above the cloud top. Sells when
 * price closes below the cloud bottom, the Tenkan crosses back below the Kijun,
 * or price falls 2.5 ATR below entry.
 * When it does NOT work: In a long sideways range the cloud flattens and the
 * cross whipsaws. In a violent crash price gaps through the ATR stop. A slow
 * grinding bull with tiny pullbacks gives few Kijun touches to enter on.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const closes = ctx.closes;
  if (closes.length < 60) return null;
  const prevClose = closes.at(-2);
  if (prevClose == null) return null;

  // Ichimoku components from CLOSED bars (ago=1), so they are identical in backtest/paper/live.
  const h9 = ctx.high(9, 1), l9 = ctx.low(9, 1);
  const h26 = ctx.high(26, 1), l26 = ctx.low(26, 1);
  const h52 = ctx.high(52, 1), l52 = ctx.low(52, 1);
  if (h9 == null || l9 == null || h26 == null || l26 == null || h52 == null || l52 == null) return null;

  const tenkan = (h9 + l9) / 2;      // conversion line
  const kijun = (h26 + l26) / 2;     // base line
  const spanA = (tenkan + kijun) / 2;
  const spanB = (h52 + l52) / 2;     // cloud = band between spanA and spanB
  const cloudTop = Math.max(spanA, spanB);
  const cloudBot = Math.min(spanA, spanB);

  // Previous closed bars for the cross (ago=2) — never (0) vs (1).
  const h9p = ctx.high(9, 2), l9p = ctx.low(9, 2);
  const h26p = ctx.high(26, 2), l26p = ctx.low(26, 2);
  if (h9p == null || l9p == null || h26p == null || l26p == null) return null;
  const tenkanP = (h9p + l9p) / 2;
  const kijunP = (h26p + l26p) / 2;

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx || price;
    const stop = entry - 2.5 * atr;   // hard stop on every position: caps the worst trade
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5 ATR stop' },
               { side: 'sell', price: cloudBot, trigger: 'below', note: 'cloud exit' }]);
    // Exit on cloud break, Tenkan/Kijun bearish cross, or the hard stop.
    if (prevClose < cloudBot || (tenkanP >= kijunP && tenkan < kijun) || price < stop) {
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // Buy: Tenkan crosses above Kijun on closed bars AND price already above the cloud top.
  if (tenkanP <= kijunP && tenkan > kijun && prevClose > cloudTop) {
    ctx.watch([{ side: 'sell', price: price - 2.5 * atr, trigger: 'below', note: '2.5 ATR stop' }]);
    return { side: 'buy', qty: (ctx.cash / price) * 0.99 };
  }
  return null;
}
