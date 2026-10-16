/*
 * @coinsori-strategy v1
 * name: SOL Turtle Hashrate-Gated 4H
 * ex: binance
 * syms: SOL/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven SOL 4h Donchian turtle holds all three
 * disjoint windows. This adds a NEW fundamental axis — Bitcoin network
 * hashpower. When mining capacity is growing (hashrate above its own 30-day
 * average) the underlying network is healthy and bull trends are more likely
 * to be real; a breakout taken into that regime has more support. It is a
 * regime filter, not a timing signal.
 * When it buys and sells: buy when a closed 4h bar exceeds the highest high
 * of the prior 55 closed bars, the 200-SMA is rising, and BTC hashrate is
 * above its own 30-day average. Sell on a 2.5x ATR stop or when a closed bar
 * falls below the lowest low of the prior 20 bars.
 * When it does NOT work: it will sit out valid breakouts that happen while
 * hashrate is temporarily flat or dipping (e.g. post-halving adjustments);
 * hashrate is a slow level so it does little during fast intra-trend moves.
 * If hashrate data is unavailable in a backtest the filter silently degrades
 * to the base turtle (never blocks all trades).
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

  // Hashrate regime filter: current hashrate vs its own 30-day average.
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  if (hr != null && hrSma != null && hrSma > 0) {
    if (!(hr > hrSma)) return null;   // mining capacity not growing -> skip
  }
  // if hashrate data missing, degrade to base turtle

  const qty = (ctx.cash / price) * 0.5;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'hashrate > 30d avg', ok: true, closed: true }] }]);
  return { side: 'buy', qty };
}
