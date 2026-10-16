/*
 * @coinsori-strategy v1
 * name: Onchain Turtle BTC
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The proven BTC 4h Donchian turtle (55-bar breakout, 200-SMA rising, 2.5x ATR stop) is a solid trend core. This version adds a NEW fundamental axis — on-chain network activity. When unique active addresses are above their 30-day average, adoption is expanding and a breakout is more likely to be a genuine new trend; when addresses are contracting (bear regime), breakouts tend to fail, so we sit them out.
 * When it buys and sells: Buy when a closed 4h bar exceeds the highest high of the prior 55 closed bars, the 200-SMA is rising, AND active addresses are above their 30-day average. Sell on a 2.5x ATR stop or when a closed bar falls below the lowest low of the prior 20 bars.
 * When it does NOT work: In sideways chop with no 55-bar breakouts it simply does nothing (no loss, no gain). It will miss breakouts that start while addresses are still contracting even if price later trends. If the on-chain dataset is missing, the strategy holds all trades (never trades), so it needs the addr data connected.
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

  // On-chain adoption filter: active addresses above their 30-day average = expanding network.
  // Unlike OI (which was null in this backtest), addr data is present and actually filters.
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  if (addr == null || addrSma == null) return null;
  if (!(addr > addrSma)) return null;

  // vol-target sizing identical to base turtle: target 1.5% of price in ATR units
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'addr>sma30', ok: addr > addrSma, closed: true }] }]);
  return { side: 'buy', qty };
}
