/*
 * @coinsori-strategy v1
 * name: Hashrate-Exit Multi-Asset Momentum 1D
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: A hashrate ENTRY gate on the champion failed — it blocked
 * buying at the start of recoveries (hashrate lags price). But hashrate decline
 * is still a real risk signal: falling mining power means miners are leaving the
 * network, which historically precedes or accompanies sharp sell-offs. This
 * variant uses hashrate ONLY to EXIT faster (sell when Bitcoin hashrate drops
 * below its 30-day average), never to block entries. Entries stay exactly the
 * champion's proven rule, so it cannot miss a recovery — it can only cut losses
 * sooner when the network is weakening.
 * When it buys and sells: buys exactly like the champion (previous close above
 * the 200-day EMA AND 30-day return positive). Sells on the 200-day EMA break,
 * negative 30-day return, 15% hard stop, OR when Bitcoin hashrate falls below
 * its own 30-day average (network stress).
 * When it does NOT work: if hashrate dips briefly during a healthy bull (e.g. a
 * short-lived miner capitulation) it sells and may re-buy slightly higher; and
 * in a broad crash all held legs still fall together.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const ema200 = ctx.ema(200, 1);
  if (ema200 == null) return null;

  const c = ctx.closes;
  if (c.length < 32) return null;
  const prevClose = c.at(-2);
  const mom30 = prevClose / c.at(-32) - 1;

  // hashrate stress signal (exit-only): Bitcoin hashrate below its 30-day average
  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  const networkWeak = hr != null && hrAvg != null && hr < hrAvg;

  const atr = ctx.atr(14, 1);
  let volScale = 1;
  if (atr != null && atr > 0 && prevClose > 0) {
    const atrPct = atr / prevClose;
    volScale = Math.min(1, 0.02 / atrPct);
  }

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop || prevClose < ema200 || mom30 < 0 || networkWeak) {
      return { side: 'sell', qty: pos };
    }
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: ema200, trigger: 'below', note: '200-day trend break',
                 conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                         { label: 'network not weak', ok: !networkWeak, closed: true }] }]);
    return null;
  }

  const uptrend = prevClose > ema200;
  ctx.watch([{ side: 'buy', price: ema200, trigger: 'above', note: 'close above 200-day EMA',
               conds: [{ label: '30d return > 0', ok: mom30 > 0, closed: true },
                       { label: 'close > 200-EMA', ok: uptrend, closed: true }] }]);
  if (!uptrend || !(mom30 > 0)) return null;

  const targetCash = ctx.cash * 0.33 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
