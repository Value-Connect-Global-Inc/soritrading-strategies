/*
 * @coinsori-strategy v1
 * name: BTC On-chain Regime Trend 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Network growth (daily active addresses above their 30-day
 * average) usually precedes and supports price trends in BTC. Combining a
 * classic 55-bar breakout with an on-chain regime filter (addresses expanding)
 * aims to buy only trends that have real usage behind them, avoiding price-only
 * fake breakouts in a sideways market.
 * When it buys and sells: buy when the last closed 4h bar exceeds the highest
 * high of the prior 55 closed bars AND daily active addresses are above their
 * 30-day average AND price is above the 200-SMA. Sell on a 20-bar low
 * breakdown, when addresses fall back below their 30-day average, or a 15%
 * hard stop.
 * When it does NOT work: it misses the start of a bull that happens while
 * addresses are still flat; it loses in fast crashes because the 15% stop is
 * wide; the daily on-chain data lags price on 4h bars so it cannot anticipate
 * an immediate move. It fails if the address dataset is missing (no entry).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);

  // On-chain regime from daily datasets (latest known values on 4h bars)
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  const addrKnown = addr != null && addrAvg != null && addrAvg > 0;

  const sma200 = ctx.sma(200, 1);

  // Donchian levels from CLOSED bars, excluding the signal bar itself
  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));   // 55 prior bars
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));   // 20 prior bars

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;   // hard stop 15% below entry (same as champion)
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };   // 20-bar low breakdown
    if (addrKnown && addr < addrAvg) return { side: 'sell', qty: pos };   // network shrinking -> exit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' },
               { side: 'sell', price: addrAvg, trigger: 'below', note: 'on-chain off' }]);
    return null;
  }

  if (sma200 == null || !addrKnown) return null;
  if (!(prevClose > h55)) return null;              // breakout
  if (!(price > sma200)) return null;               // long-term uptrend
  if (!(addr > addrAvg)) return null;               // network must be expanding

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: 'addr > 30d avg', ok: addr > addrAvg, closed: true },
                       { label: 'price > SMA200', ok: price > sma200, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);   // target 1.5% ATR risk, cap size
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
