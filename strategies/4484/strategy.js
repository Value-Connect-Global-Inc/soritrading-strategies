/*
 * @coinsori-strategy v1
 * name: MACD Opposite-Signal Exit (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same on-chain-confirmed momentum entry as the champion,
 * but the exit adds an OPPOSITE-SIGNAL rule: a fast MACD bearish cross while
 * holding signals the rally is reversing before the slow 200-day trend break
 * fires, so we exit earlier and keep more of the gain.
 * When it buys and sells: buy when 30d return > 0, close above 200d EMA and
 * active addresses >= 30d average. Sell on 15% hard stop, close below 200d EMA,
 * or a MACD(12,26,9) bearish cross on the last two closed bars.
 * When it does NOT work: in choppy markets MACD whipsaws and exits too early,
 * missing the later leg of a trend; the usage gate only reads BTC.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of last CLOSED bar

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);   // size so position contributes ~2% daily vol
  }

  const pos = ctx.position;
  if (pos > 0) {
    // Opposite-signal exit: MACD bearish cross on CLOSED bars (ago 1 vs 2).
    const m1 = ctx.macd(12, 26, 9, 1);
    const m2 = ctx.macd(12, 26, 9, 2);
    let macdBear = false;
    if (m1 != null && m2 != null && m1.signal != null && m2.signal != null) {
      macdBear = m2.macd >= m2.signal && m1.macd < m1.signal;
    }
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (macdBear) return { side: 'sell', qty: pos };             // fast reversal signal
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: 'MACD not bearish', ok: !macdBear, closed: true }] }]);
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
