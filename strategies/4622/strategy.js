/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The Crypto Fear & Greed Index swings between panic and
 * euphoria, and in a crypto uptrend the panic readings have historically marked
 * the best entry points while euphoria marks the exits. This is a CONTRARIAN /
 * sentiment strategy — the opposite family of the momentum champion. It buys
 * EXTREME FEAR (index below 25) when the coin is still in a long-term uptrend
 * (above its 200-day EMA), and sells into EXTREME GREED (index above 75).
 * When it buys and sells: buys when the Fear & Greed index is below 25 on the
 * last closed bar and the last close is above the 200-day EMA; sells when the
 * index climbs above 75, the close drops below the 200-day EMA, or a 20% hard
 * stop is hit.
 * When it does NOT work: in a true bear market the 200-day EMA filter is not
 * enough — fear readings keep coming and the stop takes a big loss; and extreme
 * fear can persist for weeks, so capital sits idle between signals.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 2) return null;
  const prevClose = c.at(-2);

  const fg = ctx.data('fear_greed');   // 0-100 sentiment index (null = unknown)
  if (fg == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.80;        // 20% hard stop below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // uptrend broken
    if (fg > 75) return { side: 'sell', qty: pos };              // extreme greed -> take profit
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '20% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'Fear&Greed', now: fg, op: '>', ref: 75 }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: 'Fear&Greed', now: fg, op: '<', ref: 25 },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend) return null;
  if (fg >= 25) return null;   // only buy extreme fear

  const targetCash = ctx.cash * 0.33;   // one third of cash — fear dips are rare, big bets
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
