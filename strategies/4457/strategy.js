/*
 * @coinsori-strategy v1
 * name: Momentum-Pullback Multi-Asset 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion buys continuation — any time momentum turns
 * positive it buys, which means it often chases local tops. A different, untested
 * timing: in a confirmed uptrend (price above a rising 200-day EMA), WAIT for a
 * shallow pullback (RSI(14) in the 40-58 band) and buy the dip. Pullbacks within
 * an uptrend tend to revert up; buying them instead of chasing breakouts should
 * give a better entry price with the same trend protection.
 * When it buys and sells: buys when the previous close is above the 200-day EMA,
 * the 200-day EMA is rising, the 30-day return is positive, AND RSI(14) of the
 * previous close is between 40 and 58 (a shallow dip, not a crash). Sells when
 * the close drops below the 200-day EMA, the 30-day return turns negative, RSI
 * climbs above 70 (overbought), or a 15% hard stop is hit.
 * When it does NOT work: in a strong straight-up rally it may never get a chance
 * to buy (no dip) and miss the whole move; in a downtrend the 200-day filter keeps
 * it out (good); in a choppy market the pullback timing can whipsaw.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  const ema200_prev20 = ctx.ema(200, 21);
  if (ema200 == null || ema200_prev20 == null) return null;
  const trendRising = ema200 > ema200_prev20;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  const rsi = ctx.rsi(14, 1);   // RSI of the last CLOSED bar
  if (rsi == null) return null;

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop || prevClose < ema200 || mom30 < 0 || rsi > 70) {
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                         { label: 'RSI < 70', ok: rsi <= 70, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  const dip = rsi >= 40 && rsi <= 58;   // shallow pullback, not a crash
  ctx.watch([{ side: 'buy', note: 'pullback in uptrend (RSI 40-58)',
               conds: [{ label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'EMA200 rising', ok: trendRising, closed: true },
                       { label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'RSI(14) 40-58', ok: dip, closed: true }] }]);
  if (!uptrend || !trendRising || !(mom30 > 0) || !dip) return null;

  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
