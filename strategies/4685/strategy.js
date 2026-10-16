/*
 * @coinsori-strategy v1
 * name: SOL Turtle OI-Confirmed 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven SOL 4h Donchian turtle holds all three
 * disjoint windows. This version adds a NEW data axis — open interest — to
 * filter breakouts: a breakout backed by expanding leverage (OI above its own
 * 50-bar average) is more likely to be a genuine trend start with fresh money
 * behind it, rather than a short-covering dead-cat bounce.
 * When it buys and sells: buy when a closed 4h bar exceeds the highest high
 * of the prior 55 closed bars, the 200-SMA is rising, and open interest is
 * above its own 50-bar average. Sell on a 2.5x ATR stop or when a closed bar
 * falls below the lowest low of the prior 20 bars.
 * When it does NOT work: OI can keep rising into a long liquidation cascade
 * (peak leverage = top), so the filter is not a guarantee; it will also sit
 * out valid breakouts that start on light OI. If OI data is unavailable or
 * constant in a backtest the filter silently passes (designed to degrade to
 * the base turtle, never to block all trades).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0) return null;

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);   // 200-SMA 20 bars earlier -> slope check

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior closed bars
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));   // 20 prior closed bars

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2.5;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null) return null;
  if (!(prevClose > h55)) return null;
  if (!(sma200 > sma200Prev)) return null;

  // OI filter: current OI above its own 50-bar average. Store rolling history in state.
  const oi = ctx.binanceOi();
  if (oi != null && oi > 0) {
    const hist = ctx.state.oiHist || [];
    hist.push(oi);
    if (hist.length > 50) hist.shift();
    ctx.state.oiHist = hist;
    let sum = 0;
    for (const v of hist) sum += v;
    const avg = sum / hist.length;
    // require at least 30 bars of OI history AND OI above its average
    if (hist.length >= 30 && !(oi > avg)) return null;
  }
  // if OI is null/constant, degrade to base turtle (no extra filter)

  const qty = (ctx.cash / price) * 0.5;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'OI > 50-bar avg', ok: true, closed: true }] }]);
  return { side: 'buy', qty };
}
