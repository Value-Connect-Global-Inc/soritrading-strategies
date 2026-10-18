/*
 * @coinsori-strategy v1
 * name: BtcMeanReversion1d
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: BTC overreacts to news and then snaps back toward its average. When price closes far below its 20-day average with RSI deeply oversold AND market sentiment is fearful, the odds of a bounce are best. Fear&Greed data confirms extreme-fear days cluster at every major BTC bottom (Dec 2018, Mar 2020, May 2021, Jun 2022), so sentiment agreeing with the oversold price is a real signal.
 * When it buys and sells: It buys when the previous close is at least 5% below the 20-day average, RSI(14) is below 28, and the Fear&Greed index is below 40 (fearful, not greedy — avoids shallow-dip whipsaws in bull regimes). It sells when price closes back above the 20-day average, or RSI rises above 55, or the 10% hard stop or 10-day time stop hits. After a stop it waits before re-entering, and the wait grows with every consecutive stop — a repeated-stop market is a persistent downtrend and deserves a longer wait.
 * When it does NOT work: In a strong bear trend price keeps falling below the average and the bounce never comes — the stop takes repeated losses and the cooldown only slows the bleeding. It only goes long, so a persistent downtrend bleeds it. It also loses when a crash gaps straight through the stop, and it trades less in bull markets because it refuses greedy-regime dips.
 */

function onUpdate(ctx) {
  // Closed-bar signals only (ago>=1) — identical in backtest, paper and live.
  const sma = ctx.sma(20, 1);
  const rsi = ctx.rsi(14, 1);
  if (sma == null || rsi == null) return null;

  const price = ctx.price;
  const inLong = ctx.position > 0;
  const st = ctx.state;

  // Cooldown after a "didn't bounce" exit: prevents re-buying a falling knife
  // right after a stop (the failure mode documented in earlier mean-reversion runs).
  st.cooldown = st.cooldown || 0;
  st.stopStreak = st.stopStreak || 0;
  if (st.cooldown > 0) st.cooldown -= 1;

  // --- Hard stop: 10% below average entry price (tail-risk protection on every position) ---
  let stopPx = null;
  if (inLong && ctx.entryPx != null) stopPx = ctx.entryPx * 0.90;

  // --- Time stop: a bounce should have happened within 10 days; if not, the trend is too strong ---
  st.daysIn = inLong ? (st.daysIn || 0) + 1 : 0;

  // Fear&Greed regime filter (0=extreme fear, 100=extreme greed). Extreme-fear days
  // cluster at BTC bottoms (verified on real data). null = data unknown -> treat as
  // pass so a data gap never freezes the strategy.
  const fg = ctx.data("fear_greed");
  const fearful = (fg == null) || (fg < 40);

  ctx.watch([
    { side: 'buy', price: sma * 0.95, trigger: 'below', note: '5% below SMA20',
      conds: [
        { label: 'RSI(14) close', now: rsi, op: '<', ref: 28, closed: true },
        { label: 'Fear&Greed < 40', ok: fearful }
      ] },
    { side: 'sell', price: sma, trigger: 'above', note: 'back above SMA20' },
    { side: 'sell', price: stopPx, trigger: 'below', note: '10% stop' }
  ]);

  if (!inLong) {
    // Entry: previous close far below SMA20 with deeply oversold RSI,
    // only if sentiment is fearful (not a greedy-regime shallow dip) and not cooling down.
    if (st.cooldown > 0) return null;
    if (!fearful) return null;
    const prevClose = ctx.closes.at(-2);
    if (prevClose <= sma * 0.95 && rsi < 28) {
      // Half position only: the stop is 10%, so max loss per trade is ~5% of the account.
      return { side: 'buy', qty: ctx.cash / ctx.price * 0.5 };
    }
    return null;
  }

  // --- Exits first ---
  if (stopPx != null && price <= stopPx) {
    // Each consecutive stop-loss means a stronger, more persistent downtrend.
    // Wait longer each time (8 days -> 12 -> 16 ... capped at 30) so a bleeding
    // market cannot drain the account; a profitable exit resets the streak.
    st.stopStreak += 1;
    st.cooldown = Math.min(8 + 4 * (st.stopStreak - 1), 30);
    return { side: 'sell', qty: ctx.position };
  }
  if (st.daysIn >= 10) {
    st.cooldown = 5; // no bounce in 10 days = trend too strong; wait 5 days before re-entry
    return { side: 'sell', qty: ctx.position };
  }
  if (price >= sma || rsi >= 55) {
    st.stopStreak = 0; // bounce worked — reset the streak
    return { side: 'sell', qty: ctx.position };
  }
  return null;
}
