/*
 * @coinsori-strategy v1
 * name: Momentum Vol-Gated + Spike Exit 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Same validated 30-day momentum + 200-day EMA logic as the
 * vol-regime-gated champion, plus the COMPLEMENTARY mechanism: the champion only
 * gates new ENTRIES on high volatility but does nothing when volatility spikes
 * while a position is open — which is exactly when momentum crashes hit. This
 * version exits on a FRESH volatility spike (ATR% crosses above its own ~90th
 * percentile on the latest closed bar) while holding. The entry gate already
 * blocks re-entry while vol stays high, so the exit does not cause churn.
 * When it buys and sells: buys when the last closed bar is above the 200-day EMA,
 * its 30-day return is positive, and realized volatility is NOT in its top decile;
 * sells on a fresh volatility spike, a drop below the 200-day EMA, negative 30-day
 * return, or a 15% hard stop.
 * When it does NOT work: in a sustained bull market volatility rises with the
 * rally, so the gate keeps you out of the early explosive phase AND the spike
 * exit can cut a winner right before the biggest part of the move; and in a
 * broad crash every leg falls together regardless of the vol gate.
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

  // fresh vol spike: current closed bar above p90 while the previous closed bar
  // was below it — the momentum-crash trigger moment (vol expansion is sudden).
  const atr2 = ctx.atr(14, 2);
  let freshSpike = false;
  if (atr2 != null && c.length >= 3) {
    const p2 = c.at(-3);
    if (p2 > 0) freshSpike = atrPct > p90 && (atr2 / p2) <= p90;
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    if (freshSpike) return { side: 'sell', qty: pos };   // momentum-crash protection
    const stop = ctx.entryPx * 0.85;        // hard stop: 15% below entry
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < ema200) return { side: 'sell', qty: pos };   // trend over
    if (mom30 < 0) return { side: 'sell', qty: pos };            // momentum faded
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                         { label: 'fresh vol spike', ok: freshSpike, closed: true }] }]);
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

  const volScale = Math.min(1, 0.02 / atrPct);   // calm coin bigger, wild coin smaller
  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
