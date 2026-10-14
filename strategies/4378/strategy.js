/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian Dip Buyer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto crashes in bull markets are driven by panic, and the
 *   Fear & Greed index measures that panic. When the index hits extreme fear
 *   (<=20) while the 100-day EMA is still RISING, that is a panic dip inside a
 *   bull market — historically a good entry. We buy the panic and ride the
 *   recovery with a trailing stop, so a real bull run is captured in full.
 * When it buys and sells: buy BTC when Fear & Greed <=20 AND the 100-day EMA is
 *   rising (a bull market, not a bear). Sell when price falls 20% below its
 *   highest close since entry, or when a 2.5x ATR hard stop hits. After any
 *   exit we wait 20 days before the next buy, so a persistent panic is not
 *   re-bought every day.
 * When it does NOT work: in a long bear market the 100-day EMA is falling, so
 *   the strategy stays in cash and never catches the bottom; it also misses
 *   steady bull markets that never show extreme fear. A V-shaped crash can still
 *   hit the hard stop.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');
  const atr = ctx.atr(14, 1);
  const ema100 = ctx.ema(100, 1);
  const ema100Prev = ctx.ema(100, 2);
  if (fg == null || atr == null || atr <= 0 || ema100 == null || ema100Prev == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);

  if (pos > 0) {
    const peak = Math.max(ctx.state.peak || prevClose, prevClose);
    ctx.state.peak = peak;
    const trailStop = peak * 0.80;             // give back 20% of the run before exiting
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    if (price <= trailStop) {
      ctx.state.lastExit = ctx.i;
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing -20%' }]);
    return null;
  }

  // Cooldown: after an exit, wait 20 days before buying the same panic again
  const sinceExit = ctx.i - (ctx.state.lastExit != null ? ctx.state.lastExit : -999);
  if (sinceExit < 20) return null;

  const emaRising = ema100 > ema100Prev;       // bull market only: rising 100-day EMA
  if (fg > 20) return null;                    // only buy at extreme fear
  if (!emaRising) return null;                 // never buy fear in a falling-trend bear

  const riskCash = ctx.cash * 0.01;            // risk only 1% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
