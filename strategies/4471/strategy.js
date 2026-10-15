/*
 * @coinsori-strategy v1
 * name: Active-Address + Sentiment-Cap Momentum (BTC 1D)
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: The champion buys BTC momentum when network usage (active
 * addresses) is rising. We add a sentiment top-filter: when the Fear & Greed index
 * is already in extreme greed (>= 80), the crowd is euphoric and the rally is late
 * in its life — buying there has poor risk/reward. So we wait for a fresh push.
 * This is the OPPOSITE of the failed contrarian (which bought extreme fear as a
 * knife-catch). We never short; we only skip late-euphoria entries.
 * When it buys and sells: buys when the 30-day return is positive, close above the
 * 200-day EMA, active addresses >= 30d avg, AND Fear&Greed < 80. Sells on close
 * below 200-day EMA, 30-day return negative, or 15% hard stop.
 * When it does NOT work: in a powerful bull market where greed stays high for
 * months, the cap keeps us out of the strongest stretch — we give up the top of
 * the run to avoid chasing it. If greed never reaches 80 in a window, it changes
 * nothing (pure champion).
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;   // 30-day return of the last CLOSED bar

  // volatility target: size so the position contributes ~2% daily vol to the pool
  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  // Sentiment cap: do not enter when Fear&Greed is extreme greed (>= 80).
  // Missing data → allow (never silently block on missing data).
  const fg = ctx.data('fear_greed');
  let notEuphoric = true;
  if (fg != null) notEuphoric = fg < 80;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;          // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // On-chain gate: buy only when active addresses are at/above their 30-day average.
  const addr = ctx.data('addr');
  const addrAvg = ctx.data('addr_sma30');
  let usageUp = true;
  if (addr != null && addrAvg != null) usageUp = addr >= addrAvg;

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'active addr >= 30d avg', ok: usageUp, closed: true },
                       { label: 'Fear&Greed < 80', ok: notEuphoric, closed: true }] }]);
  if (!uptrend || !(mom30 > 0) || !usageUp || !notEuphoric) return null;

  const targetCash = ctx.cash * volScale;      // single-asset pool, vol-scaled
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
