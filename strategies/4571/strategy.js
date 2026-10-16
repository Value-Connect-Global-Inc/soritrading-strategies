/*
 * @coinsori-strategy v1
 * name: FearGreed Multi-Asset Regime Basket v4 (Dollar filter)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the Crypto Fear & Greed Index is a crowd-sentiment gauge.
 * In crypto, momentum persists: when the crowd is greedy (index >= 55) prices
 * keep climbing, and when the crowd turns fearful (index <= 40) the trend has
 * broken. This rides confirmed sentiment on a 4-coin basket so no single asset
 * decides the account. NEW in v4: only enter when the broad US dollar index is
 * NOT in a strong regime. Crypto is a dollar-funded risk asset — a strong
 * dollar drains the liquidity that paid for the last rally, so greed signals
 * during a strong-dollar regime are filtered out (v3 already filtered out the
 * Fed hiking; the dollar index adds the currency-pressure axis).
 * When it buys and sells: on each asset, buy when Fear & Greed >= 55 AND price
 * is above its 200-day average AND the Fed is not hiking AND the dollar index
 * is below 113 (recent-era mean of the broad trade-weighted dollar). Sell when
 * it falls to <= 40 or price drops 25% below entry (hard stop).
 * When it does NOT work: in a fast crash the index can still be high while
 * prices are already falling (the index lags) — the 200-day filter reduces
 * these entries but cannot remove all of them. The 25% stop turns a normal
 * dip into a realized loss, and it misses the very start of a bull because it
 * waits for confirmed greed. The fixed dollar threshold (113) is a blunt tool:
 * the dollar regime drifts over years, so one number cannot fit every era.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  // ctx.data returns strings — coerce to number.
  const fg = Number(ctx.data('fg'));
  if (!Number.isFinite(fg)) return null;

  const pos = ctx.position;
  if (pos > 0) {
    const entry = ctx.entryPx;
    if (entry != null) {
      // 25% hard stop: caps the loss on any single position.
      if (price <= entry * 0.75) return { side: 'sell', qty: pos };
      ctx.watch([{ side: 'sell', price: entry * 0.75, trigger: 'below', note: 'stop: -25%' }]);
    }
    if (fg <= 40) return { side: 'sell', qty: pos }; // greed over -> exit
    return null;
  }

  // Trend filter: only enter when price is above its 200-day average (closed
  // bar). The F&G index lags price in a fast crash — this avoids buying into
  // a downtrend that the index has not yet registered.
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  // Fed liquidity filter: only buy while the Fed is NOT hiking — current fed
  // funds rate above its 30-day-ago value = tightening = hostile for a
  // zero-yield risk asset. Missing data = not hiking (permissive).
  const fed = Number(ctx.data('fed'));
  const fedLag = Number(ctx.data('fed_lag30'));
  const fedHiking = Number.isFinite(fed) && Number.isFinite(fedLag) && fed > fedLag;

  // Dollar regime filter (NEW in v4): skip entries while the broad US dollar
  // index is above 113. 113 = recent-era (2018-2026) mean of the broad
  // trade-weighted dollar index — a strong dollar drains risk-asset liquidity.
  // Missing data = not strong (permissive), so weekends don't block entries.
  const dxy = Number(ctx.data('dxy'));
  const strongDollar = Number.isFinite(dxy) && dxy > 113;

  if (fg >= 55 && price > sma200 && !fedHiking && !strongDollar) {
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }

  // Declare what we are waiting for so the run card shows it.
  ctx.watch([{
    side: 'buy',
    price: fg >= 55 ? sma200 : price,
    trigger: 'above',
    note: 'enter: greed>=55 & trend up & fed ok & dollar ok',
    conds: [{ label: 'F&G index', now: fg, op: '>=', ref: 55, closed: true },
           { label: 'Fed not hiking', ok: !fedHiking },
           { label: 'Dollar < 113', ok: !strongDollar }]
  }]);
  return null;
}
