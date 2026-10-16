/*
 * @coinsori-strategy v1
 * name: Momentum Vol-Regime Gated 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Volatility clusters — calm periods stay calm, and violent
 * periods stay violent. Trend/momentum signals are unreliable right after a
 * volatility spike (the momentum-crash literature), so this strategy rides the
 * same validated 30-day momentum + 200-day EMA logic as the champion but adds a
 * regime gate: when a coin's realized volatility (ATR as % of price) is in its
 * own top decile over the past year, we do NOT open new positions. The champion
 * uses volatility only to SHRINK size; this uses it to SWITCH the regime off,
 * which is a different mechanism.
 * When it buys and sells: a leg buys when the last closed bar is above the 200-day
 * EMA, its 30-day return is positive, and its realized volatility is NOT in the
 * top decile; sells when the closed bar drops below the 200-day EMA, the 30-day
 * return turns negative, or a 15% hard stop is hit.
 * When it does NOT work: in a sustained bull market the gate keeps you out during
 * the early explosive phase (vol is high at the start of a rally), so you miss
 * part of the move; and in a broad crash every leg falls together regardless of
 * the gate.
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

  // realized volatility regime: ATR as % of price, compared to its own history.
  // If current vol is above the ~90th percentile of the last 365 closed bars,
  // treat the regime as "too violent to trust momentum" (momentum-crash regime).
  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const hist = ctx.closes.slice(-365, -1).map((cl, i, arr) => {
    // approximate per-bar vol history using the same ATR definition is expensive;
    // use rolling range proxy: |close - prev close| / prev close
    if (i === 0) return 0;
    const p = arr[i - 1];
    return p > 0 ? Math.abs(cl / p - 1) : 0;
  });
  hist.sort((a, b) => a - b);
  const p90 = hist.length >= 30 ? hist[Math.floor(hist.length * 0.9)] : 1;
  const highVol = atrPct > p90;   // current vol above its own ~90th percentile

  // volatility-scaled sizing: calm coin gets bigger position, wild coin smaller
  let volScale = 1;
  const atrScale = Math.min(1, 0.02 / atrPct);
  volScale = atrScale;

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
                       { label: 'vol not extreme', ok: !highVol, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
