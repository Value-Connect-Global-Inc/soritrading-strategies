/*
 * @coinsori-strategy v1
 * name: BTC Long-Short Regime Rider 4H
 * ex: binance
 * syms: BTC/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: BTC moves in long multi-month trends, both up and down. A slow 200-bar
 * (about 33 days) SMA separates bull regimes from bear regimes. Going LONG above it and SHORT
 * below it lets the strategy earn in both directions instead of only riding up-trends. The 2%
 * hysteresis band creates a dead zone around the SMA so small noise does not churn the position,
 * and a hard stop on every position caps a single bad trade. This addresses the main weakness of
 * a long-only rider: it no longer sits in cash (or rides down) during a bear market.
 * When it buys and sells: When the last closed bar closes more than 2% above the SMA, go long;
 * when it closes more than 2% below the SMA, go short. Between the two lines, hold what you have.
 * A hard stop closes any position that moves 8% against entry.
 * When it does NOT work: In a long flat sideways range the price still crosses the band edges and
 * each crossing costs fees (whipsaw). It lags sharp V-shaped reversals, and shorting into a
 * violent short-squeeze rally can be painful. Perpetual funding is paid while short, which drags
 * returns in a market that is persistently long-favored.
 */
function onUpdate(ctx) {
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const band = 0.02;
  const pos = ctx.position || 0;

  // hard stop on any open position: close if price moved 8% against entry
  if (pos !== 0 && ctx.entryPx != null) {
    const stopLong = ctx.entryPx * 0.92;
    const stopShort = ctx.entryPx * 1.08;
    const longStopHit = pos > 0 && prevClose < stopLong;
    const shortStopHit = pos < 0 && prevClose > stopShort;
    if (longStopHit || shortStopHit) {
      ctx.watch([{ side: pos > 0 ? 'sell' : 'buy', price: pos > 0 ? stopLong : stopShort, trigger: pos > 0 ? 'below' : 'above', note: '8% hard stop' }]);
      return { side: pos > 0 ? 'sell' : 'buy', qty: Math.abs(pos), reduceOnly: true };
    }
  }

  const enterLong = sma200 * (1 + band);
  const enterShort = sma200 * (1 - band);

  if (pos > 0) {
    // exit long when it breaks below the SMA band
    ctx.watch([{ side: 'sell', price: sma200 * (1 - band), trigger: 'below', note: 'SMA200 -2% breakdown' }]);
    if (prevClose < enterShort) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }
  if (pos < 0) {
    // exit short when it breaks above the SMA band
    ctx.watch([{ side: 'buy', price: sma200 * (1 + band), trigger: 'above', note: 'SMA200 +2% breakout' }]);
    if (prevClose > enterLong) {
      return { side: 'buy', qty: Math.abs(pos), reduceOnly: true };
    }
    return null;
  }

  // flat: go long above the band, short below the band
  ctx.watch([{ side: 'buy', price: enterLong, trigger: 'above', note: 'SMA200 +2% go long' },
             { side: 'sell', price: enterShort, trigger: 'below', note: 'SMA200 -2% go short' }]);
  if (prevClose > enterLong) {
    return { side: 'buy', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  if (prevClose < enterShort) {
    return { side: 'sell', qty: (ctx.cash / ctx.price) * 0.99 };
  }
  return null;
}
