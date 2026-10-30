/*
 * @coinsori-strategy v1
 * name: ETH Funding Contrarian 4H
 * ex: binance
 * syms: ETH/USDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: The funding rate shows where the crowd is positioned. When funding is deeply negative, shorts pay longs — a crowded short that often squeezes. When funding is very positive, longs are crowded and the move is stretched.
 * When it buys and sells: Buy when funding is deeply negative (crowded shorts) while the price is still above the 200-bar average (bull regime). Sell when funding turns very positive (crowded longs), or on a 25% trailing stop / 25% hard stop.
 * When it does NOT work: In a strong bear market the SMA200 filter keeps it out, but a deep crash can still trigger the hard stop. Funding can stay negative for a long time while price keeps falling (2022), so the trend filter is essential.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  const pos = ctx.position;
  const funding = ctx.funding;
  const sma200 = ctx.sma(200, 1);
  if (sma200 == null) return null;

  const st = ctx.state || {};
  const entryPx = ctx.entryPx;

  // --- exits (while holding) ---
  if (pos > 0) {
    const peak = (st.peak == null || price > st.peak) ? price : st.peak;
    st.peak = peak;
    ctx.state = st;

    // hard stop 25% below entry (the entryPx guard: a run may start holding with unknown entry)
    if (entryPx != null && price < entryPx * 0.75) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // trailing stop 25% below the highest price since entry
    if (price < peak * 0.75) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    // crowded-long exit: funding turns strongly positive -> take profit
    if (funding != null && funding > 0.0003) {
      return { side: 'sell', qty: pos, reduceOnly: true };
    }
    return null;
  }

  // --- entry: deeply negative funding + bull regime ---
  // -0.0002 = -0.02% per 8h: a clear crowded-short signal, not just noise
  if (funding != null && funding < -0.0002 && price > sma200) {
    return { side: 'buy', qty: ctx.cash / ctx.price * 0.95 };
  }

  return null;
}
