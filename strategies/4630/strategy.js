/*
 * @coinsori-strategy v1
 * name: On-Chain + Vol-Regime Gated BTC 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Two pre-validated regime signals combined on BTC 1d. (1)
 * On-chain demand: rallies backed by growing daily active addresses are more
 * durable than rallies on thin usage, so we only buy when active addresses are
 * above their 30-day average. (2) Volatility regime: trend/momentum signals are
 * unreliable right after a volatility spike (the momentum-crash literature), so we
 * additionally do NOT open a new position while realized volatility is in its own
 * top decile over the past year. Each gate was validated separately in earlier
 * work; this strategy is their cross on a single asset.
 * When it buys and sells: buy when the last closed bar sits above the 200-day EMA,
 * its 30-day return is positive, active addresses are above their 30-day average,
 * and realized volatility is NOT in its top decile. Sell when price closes below
 * the 200-day EMA, the 30-day return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: active-address data is published with a lag and can stay
 * elevated after a top (usage peaks while price is still falling), so the filter
 * gives a false sense of support in early bear phases; and in a pure liquidity-
 * driven rally with no new users it keeps you out. The vol gate also keeps you out
 * of the explosive start of a rally (vol is high at the beginning).
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

  // on-chain demand: active addresses vs their own 30-day average.
  // null = not ready / dataset missing -> fall back to price-only (no false block).
  const addr = ctx.data('addr');
  const addrSma = ctx.data('addr_sma30');
  const networkUp = addr == null || addrSma == null ? null : addr > addrSma;

  // realized volatility regime: ATR as % of price vs its own ~90th percentile
  // over the last 365 closed bars. High vol = momentum-crash regime, no new buys.
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
  const highVol = atrPct > p90;   // current vol above its own ~90th percentile

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const entry = ctx.entryPx;
    const stop = entry && entry > 0 ? entry * 0.85 : 0;   // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true }] }]);
    return null;
  }

  // regime gates: do NOT open new positions while on-chain demand is contracting
  // OR volatility is extreme (momentum-crash regime)
  if (networkUp === false || highVol) return null;
  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true },
                       { label: 'addr > 30d avg', ok: networkUp !== false, closed: true },
                       { label: 'vol not extreme', ok: !highVol, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const volScale = Math.min(1, 0.02 / atrPct);   // calm coin gets bigger, wild coin smaller
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
