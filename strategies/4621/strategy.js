/*
 * @coinsori-strategy v1
 * name: Momentum Vol-Gated + Trend Confirm 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same validated 30-day momentum + 200-day EMA + volatility
 * regime gate as the champion, plus one extra trend-confirmation filter: the
 * 200-day EMA itself must be RISING, not just price above it. Momentum works
 * best in a confirmed long-term uptrend; requiring a rising 200-day EMA filters
 * out bear-market rallies where price pops above a falling long-term average and
 * momentum then fails.
 * When it buys and sells: buys when the last closed bar is above the 200-day EMA,
 * the 200-day EMA is rising, its 30-day return is positive, and realized
 * volatility is NOT in its top decile; sells when the closed bar drops below the
 * 200-day EMA, the 30-day return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: in a sustained bull market the volatility gate keeps you
 * out of the early explosive phase (vol is high at the start of a rally), and in
 * a broad crash every leg falls together regardless of the filters.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;
  const ema200Prev = ctx.ema(200, 21);   // 200-EMA ~20 bars earlier (about a month)
  if (ema200Prev == null) return null;
  const emaRising = ema200 > ema200Prev;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of last CLOSED bar

  // realized-vol regime: ATR% vs its own ~90th percentile over the past year
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const hist = ctx.closes.slice(-365, -1).map((cl, i, arr) => {
    if (i === 0) return 0;
    const p = arr[i - 1];
    return p > 0 ? Math.abs(cl / p - 1) : 0;
  });
  hist.sort((a, b) => a - b);
  const p90 = hist.length >= 30 ? hist[Math.floor(hist.length * 0.9)] : 1;
  const highVol = atrPct > p90;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;        // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // regime gate: do NOT open a new position while realized vol is in its top decile
  if (highVol) return null;
  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: '200-EMA rising', ok: emaRising, closed: true },
                       { label: 'vol not extreme', ok: !highVol, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !emaRising) return null;

  const volScale = Math.min(1, 0.02 / atrPct);   // calm coin bigger, wild coin smaller
  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
