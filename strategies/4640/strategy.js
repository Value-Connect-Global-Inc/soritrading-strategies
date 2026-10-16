/*
 * @coinsori-strategy v1
 * name: BTC Donchian + Hashrate Regime 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The validated Donchian breakout (55-bar high entry,
 * 20-bar low exit, 15% stop, rising-200-SMA filter) is kept, and a hashrate
 * regime filter is added: only buy breakouts while Bitcoin network hash power
 * is above its 30-day average. Hashrate is a slow fundamental that reflects
 * real mining investment, so it confirms that a price breakout sits on a
 * healthy network rather than pure speculation.
 * When it buys and sells: buy when the last closed 4h bar exceeds the highest
 * high of the prior 55 closed bars, the 200-SMA is rising, AND hashrate is
 * above its 30-day average. Sell below the lowest low of the prior 20 closed
 * bars or a 15% hard stop.
 * When it does NOT work: hashrate is slow and lags price, so it can miss the
 * start of a bull that runs before mining power catches up; it fails if the
 * hashrate dataset is missing (no entry). A falling-hashrate crash can still
 * hurt because the 15% stop is wide.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 260) return null;
  const prevClose = c.at(-2);

  const hr = ctx.data('hashrate');
  const hrAvg = ctx.data('hashrate_sma30');
  const hrKnown = hr != null && hrAvg != null && hrAvg > 0;

  const sma200 = ctx.sma(200, 1);
  const sma200Prev = ctx.sma(200, 21);

  let h55 = -Infinity;
  for (let k = 3; k <= 57; k++) h55 = Math.max(h55, c.at(-k));
  let l20 = Infinity;
  for (let k = 3; k <= 22; k++) l20 = Math.min(l20, c.at(-k));

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.85;
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose < l20) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '15% stop' },
               { side: 'sell', price: l20, trigger: 'below', note: '20-bar low breakdown' }]);
    return null;
  }

  if (sma200 == null || sma200Prev == null || !hrKnown) return null;
  if (!(prevClose > h55)) return null;
  if (!(sma200 > sma200Prev)) return null;
  if (!(hr > hrAvg)) return null;   // network must be expanding

  ctx.watch([{ side: 'buy', price: h55, trigger: 'above', note: '55-bar high breakout',
               conds: [{ label: '200-SMA rising', ok: sma200 > sma200Prev, closed: true },
                       { label: 'hashrate > 30d avg', ok: hr > hrAvg, closed: true }] }]);

  const atr = ctx.atr(14, 1);
  if (atr == null || atr <= 0 || prevClose <= 0) return null;
  const atrPct = atr / prevClose;
  const volScale = Math.min(1, 0.015 / atrPct);
  const targetCash = ctx.cash * 0.95 * volScale;
  const qty = (targetCash / price) * 0.95;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
