/*
 * @coinsori-strategy v1
 * name: Momentum-Age Exit (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same on-chain-confirmed momentum entry as the champion,
 * but the exit adds a TIME-based rule: when the 30-day return has stayed
 * positive for many consecutive days the rally is "old" and more likely to
 * stall, so we take profit before it fades instead of waiting for a trend break.
 * When it buys and sells: buy when 30d return > 0, close above 200d EMA and
 * active addresses >= 30d average. Sell on 15% hard stop, close below 200d EMA,
 * 30d return negative, OR after 60 consecutive positive-return days (age cap).
 * When it does NOT work: in long strong bull runs the age cap sells too early
 * and underperforms buy-and-hold; the usage gate only reads BTC.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 62) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of last CLOSED bar

  // Count consecutive bars (from the last CLOSED bar backward) where the 30d
  // return was positive. This measures how "old" the current rally is.
  let age = 0;
  for (let k = 2; k < c.length - 29; k++) {
    const m = c.at(-k) / c.at(-k - 30) - 1;
    if (!Number.isFinite(m) || m <= 0) break;
    age++;
  }
  const ageCap = 60;   // 60 consecutive positive days = old rally, take profit

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);   // size so position contributes ~2% daily vol
  }

  const pos = ctx.position;
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    if (age >= ageCap) return { side: 'sell', qty: pos };        // rally too old
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                         { label: 'rally age < 60d', ok: age < ageCap, closed: true }] }]);
    return null;
  }

  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'active addr >= 30d avg', ok: usageUp, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp) return null;

  const targetCash = ctx.cash * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
