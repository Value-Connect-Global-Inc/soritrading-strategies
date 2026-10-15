/*
 * @coinsori-strategy v1
 * name: ETH Panic-Dip Mean Reversion (1D)
 * ex: binance
 * syms: ETH/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: sharp panic sell-offs in Ethereum overshoot to the downside and
 * usually snap back. We buy only when the drop is extreme (RSI(2) very low AND price
 * far below its 20-day average) and ride the bounce back to the average to exit.
 * When it buys and sells: buys when the previous closed bar was deeply oversold
 * (RSI(2) below 10 and close below SMA20 minus 2 ATR). Sells when price recovers to
 * the 20-day average, when RSI(2) climbs above 50, or a 10% hard stop is hit.
 * When it does NOT work: in a persistent downtrend "cheap" keeps getting cheaper and
 * the 10% stop is hit repeatedly. Expect small losses in bear markets; the edge pays
 * in choppy-to-up markets where dips get bought.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const c = ctx.closes;
  if (c.length < 40) return null;
  const prevClose = c.at(-2);

  const rsi = ctx.rsi(2, 1);
  const sma20 = ctx.sma(20, 1);
  const atr = ctx.atr(14, 1);
  if (rsi == null || sma20 == null || atr == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const stop = ctx.entryPx * 0.90;   // hard stop 10% below entry: a dip that keeps sliding is not a dip
    if (price <= stop) return { side: 'sell', qty: pos };
    if (prevClose >= sma20) return { side: 'sell', qty: pos };   // back at the average = mean reversion done
    const rsiNow = ctx.rsi(2, 0);
    if (rsiNow != null && rsiNow > 50) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: stop, trigger: 'below', note: '10% stop' },
               { side: 'sell', price: sma20, trigger: 'above', note: 'recovered to SMA20',
                 conds: [{ label: 'close >= SMA20', ok: prevClose >= sma20, closed: true }] }]);
    return null;
  }

  const band = sma20 - 2.0 * atr;      // 2 ATR below the 20-day average = unusually deep
  const deepOversold = rsi < 10;       // RSI(2) extreme panic level
  const belowBand = prevClose < band;
  ctx.watch([{ side: 'buy', price: band, trigger: 'below', note: 'deep oversold dip',
               conds: [{ label: 'RSI(2) < 10', ok: deepOversold, closed: true },
                       { label: 'close < SMA20-2ATR', ok: belowBand, closed: true }] }]);
  if (!deepOversold || !belowBand) return null;

  const stop = price * 0.90;
  const riskPct = (price - stop) / price;   // ~0.10
  const qty = (ctx.cash * 0.01) / (price * riskPct) * 0.95;   // risk 1% of cash per trade
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
