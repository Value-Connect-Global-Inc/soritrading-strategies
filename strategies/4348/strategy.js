/*
 * @coinsori-strategy v1
 * name: On-Chain Confirmed BTC Trend 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC price trends backed by a growing mining network
 *   (hashrate above its own 30-day average) are more likely to be real and
 *   durable. This adds an on-chain fundamental filter on top of a plain
 *   200-day trend rule, so we only chase breakouts when the network is
 *   actually expanding — a different axis from pure price trend-following.
 * When it buys and sells: buy when price closes above its 200-day EMA while
 *   hashrate is above its 30-day average. Sell when price closes back below
 *   the 200-day EMA or hits a 2.5x ATR hard stop.
 * When it does NOT work: in a long sideways chop around the 200-day EMA it
 *   whipsaws and the ATR stops get clipped; hashrate is daily and lags price,
 *   so it cannot catch fast crashes early. It also sits in cash for long
 *   stretches — most gains come from a few big trend legs.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const prevClose = ctx.closes.at(-2);
  const prevPrevClose = ctx.closes.at(-3);
  if (ema200 == null || prevClose == null || prevPrevClose == null) return null;

  // On-chain confirmation: mining network still expanding vs its own 30d average.
  const hr = ctx.data('hashrate');
  const hrSma = ctx.data('hashrate_sma30');
  const netGrowing = hr != null && hrSma != null && hrSma > 0 && hr > hrSma;

  const atr = ctx.atr(14, 1);
  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const hardStop = (atr != null && atr > 0 && ctx.entryPx != null) ? ctx.entryPx - 2.5 * atr : null;
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-EMA break' }]);
    if (hardStop != null && price <= hardStop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };
    return null;
  }

  // Entry: fresh cross above the 200-day EMA, only when the network is expanding.
  const crossUp = prevClose > ema200 && prevPrevClose <= ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: '200-EMA cross',
               conds: [{ label: 'prev close > 200-EMA', ok: prevClose > ema200, closed: true },
                       { label: 'hashrate > its 30d avg', ok: netGrowing, closed: true }] }]);
  if (!crossUp) return null;
  if (!netGrowing) return null;

  const qty = (ctx.cash / price) * 0.9;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
