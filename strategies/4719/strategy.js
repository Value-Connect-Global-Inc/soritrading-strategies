/*
 * @coinsori-strategy v1
 * name: BTC Hashrate Momentum 1D
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Bitcoin miners invest in hardware and energy before price follows —
 * a rising network hash rate has historically led or confirmed BTC bull cycles, while a
 * stalling hash rate marks the end of a trend. We trade the infrastructure signal directly
 * instead of price breakouts, a different family from the Donchian champion.
 * When it buys and sells: buys when the 30-day average hash rate is above its value 60
 * days ago (network growing) AND price closes above its 200-day SMA (confirmed uptrend).
 * Sells on a 2x ATR stop, when hash rate growth stalls (30d avg below its 60d-ago level),
 * or when price closes below its 200-day SMA.
 * When it does NOT work: hash rate is slow-moving, so entries lag price; in a sharp
 * liquidity crash the 200-day SMA gate keeps you out of the capitulation bounce; and
 * hash rate can keep rising into a price top (miners over-invested), delaying the sell.
 * Needs the hashrate_sma30 dataset connected.
 */
const hRateHist = []; // module-level history of 30-day avg hash rate, one per bar

function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;
  const hr = ctx.data('hashrate_sma30');
  if (hr == null) return null; // on-chain data missing — never treat null as 0
  hRateHist.push(hr);
  if (hRateHist.length < 65) return null; // need 60-bar history for the growth lookback

  const c = ctx.closes;
  if (c.length < 220) return null;

  const atr = ctx.atr(14, 1);
  const sma200 = ctx.sma(200, 1);
  if (atr == null || atr <= 0 || sma200 == null || sma200 <= 0) return null;

  const prevClose = c.at(-2);
  const pos = ctx.position;
  const hr60 = hRateHist[hRateHist.length - 61];
  const growing = hr60 != null && hr > hr60;

  // Exit first: 2x ATR hard stop, growth stall, or price falls below 200-day SMA
  if (pos > 0) {
    const stop = ctx.entryPx == null ? null : ctx.entryPx - atr * 2;
    if (stop != null && price <= stop) return { side: 'sell', qty: pos };
    if (!growing) return { side: 'sell', qty: pos };
    if (prevClose < sma200) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '2x ATR stop' },
               { side: 'sell', price: sma200, trigger: 'below', note: 'below 200d avg' }]);
    return null;
  }

  // Entry: hash rate growth accelerating AND price in a confirmed uptrend.
  // The 200-day SMA keeps us from buying mid-bear while hash rate is still falling.
  if (!growing || !(prevClose > sma200)) {
    ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'confirmed uptrend',
                 conds: [{ label: 'hashrate 30d avg rising', ok: growing, closed: true }] }]);
    return null;
  }

  const qty = (ctx.cash * 0.99) / price;
  if (qty <= 0) return null;
  ctx.watch([{ side: 'buy', price: sma200, trigger: 'above', note: 'confirmed uptrend',
               conds: [{ label: 'hashrate 30d avg rising', ok: growing, closed: true }] }]);
  return { side: 'buy', qty };
}
