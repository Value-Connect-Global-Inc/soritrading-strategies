/*
 * @coinsori-strategy v1
 * name: BTC 4H US-Session Mean Reversion
 * ex: binance
 * syms: BTCUSDT
 * interval: 4h
 * cash: 10000
 *
 * Why this strategy: Crypto liquidity and volatility are not uniform across the 24h day.
 * The US afternoon/evening session (roughly 13:00-21:00 UTC) carries the bulk of institutional
 * flow and the largest intraday swings, so pullbacks in that window are more likely to mean-revert
 * cleanly. This is a calendar/session-aware mean-reversion — a different family from pure
 * price-based entries, and fully testable with price data alone.
 * When it buys and sells: buys when BTC closes below EMA20 minus 2.5x ATR with RSI(14)<40 AND the
 * candle's hour is in the US session window; sells when price recovers above the 20-EMA.
 * When it does NOT work: the session filter cuts the number of entries sharply, so in a quiet
 * regime with few US-session dips it sits in cash and misses moves. If the session timing is
 * miscalibrated for the asset it adds nothing but fewer trades.
 *
 * 2026-04-26: ctx.watch 추가 (표시만 바뀜, 매매 판단은 그대로)
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) {
    ctx.watch([]);
    return null;
  }

  const st = ctx.state;
  // Probe the candle object shape once so we know the timestamp field name.
  if (!st.probed && ctx.i === 100) {
    st.probed = true;
    ctx.log('candle keys: ' + (ctx.candle ? Object.keys(ctx.candle).join(',') : 'null'));
  }

  const ema20 = ctx.ema(20, 1);
  const atr = ctx.atr(14, 1);
  const rsi = ctx.rsi(14, 1);
  if (ema20 == null || atr == null || atr <= 0 || rsi == null) {
    ctx.watch([]);
    return null;
  }

  const pos = ctx.position;
  let cd = st.cd || 0;
  if (cd > 0) cd--;
  st.cd = cd;

  if (pos > 0) {
    ctx.watch([{
      side: 'sell',
      price: ema20,
      trigger: 'above',
      qty: pos,
      note: 'Sell above EMA20',
      conds: [{ label: 'cooldown done', ok: cd === 0 }]
    }]);
    if (price > ema20 && cd === 0) {
      st.cd = 2;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  // US session gate: only enter on 4h candles at UTC hours 16 and 20 (US afternoon/evening).
  const ts = ctx.candle && (ctx.candle.ts != null ? ctx.candle.ts : (ctx.candle.time != null ? ctx.candle.time : (ctx.candle.t != null ? ctx.candle.t : null)));
  if (ts == null) {
    ctx.watch([]);
    return null;
  }
  const hour = (Math.floor(ts / 3600) % 24 + 24) % 24;
  const inUsSession = (hour === 16 || hour === 20);

  const keltnerLow = ema20 - 2.5 * atr;
  ctx.watch([{
    side: 'buy',
    price: keltnerLow,
    trigger: 'below',
    qty: (ctx.cash / price) * 0.95,
    note: 'EMA20 - 2.5 ATR touch',
    conds: [
      { label: 'RSI(14) close', now: rsi, op: '<', ref: 40, closed: true },
      { label: 'US session', ok: inUsSession },
      { label: 'cooldown done', ok: cd === 0 }
    ]
  }]);

  if (price < keltnerLow && rsi < 40 && inUsSession && cd === 0) {
    st.cd = 2;
    return { side: 'buy', qty: (ctx.cash / price) * 0.95 };
  }
  return null;
}
