/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian Dip Buyer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment swings to extremes. When the Fear & Greed
 *   index hits extreme fear (<=20), the crowd is panicking — historically a good
 *   entry. We buy the panic and ride the recovery with a trailing stop, so a
 *   real bull run is captured in full instead of being cut short.
 * When it buys and sells: buy BTC when the Fear & Greed index drops to <=20.
 *   Sell when price falls 20% below its highest close since entry, or when a
 *   2.5x ATR hard stop hits. No greed-based exit, so winners can run.
 * When it does NOT work: in a long grinding bear market the index keeps hitting
 *   extreme fear and each dip-buy loses a little (the stop caps each loss but
 *   repeated whipsaws add up). It also misses slow steady bulls that never show
 *   extreme fear. This is a mean-reversion bet, not a trend bet.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');           // 0..100, daily sentiment
  const atr = ctx.atr(14, 1);
  if (fg == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos();
  if (pos > 0) {
    const peak = Math.max(ctx.state.peak || prevClose, prevClose);
    ctx.state.peak = peak;
    const trailStop = peak * 0.80;             // give back 20% of the run before exiting
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (price <= trailStop) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing -20%' }]);
    return null;
  }

  // Buy only at extreme fear (no trend filter — the panic bottom is the edge)
  ctx.watch([{ side: 'buy', price: null, note: 'fear_greed' }]);
  if (fg > 20) return null;

  const riskCash = ctx.cash * 0.01;            // risk only 1% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
```

Wait, the watch for buy with price:null and no 'at' — is that allowed? The contract says "Omit it only when there is truly no price/time condition (e.g. pure ML score)". For a pure sentiment strategy, there IS no price/time condition — the signal is the FG value. So I could omit watch entirely. But then the card says "no wait condition". Hmm. Let me instead provide a watch with the fg condition... but watch requires price or at.

Actually, re-reading: "Whenever the strategy has a concrete entry/exit price (or time) it is waiting on, call ctx.watch([...]) EVERY tick". For a pure sentiment strategy there's no price/time. So omitting is allowed but the card shows "no wait condition". That's honest. Let me omit watch for the buy side, and for the sell side I have real prices (hardStop, trailStop) so I'll call watch only when holding.

But the buy has no price condition — fine, omit. Actually wait, rule 6 says omit only when truly no price/time condition. The buy signal is fg<=20. So yes, omit.

Hmm, but actually there might be value in declaring the buy as a "condition" watch... no, watch entries need price or at. I'll omit for buy. For sell, declare the two stops.

Wait, but if I omit watch on the buy side, the card shows "no wait condition" — acceptable per rule 6 for pure sentiment. OK.

Let me save this and run 3 windows.

Actually, hold on — let me reconsider using ctx.pos(ctx.sym) vs ctx.position. The contract lists ctx.position and ctx.pos(sym, ex?). Let me use ctx.pos(ctx.sym) to be consistent with the previous strategy which used that. Actually the previous strategy used ctx.pos(sym). Fine.

Let me save and run.</think>

<｜DSML｜tool_calls>
<｜DSML｜invoke name="save_strategy">
<｜DSML｜parameter name="code" string="true">/*
 * @coinsori-strategy v1
 * name: Fear-Greed Contrarian Dip Buyer
 * ex: binance
 * syms: BTC/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: Crypto sentiment swings to extremes. When the Fear & Greed
 *   index hits extreme fear (<=20), the crowd is panicking — historically a good
 *   entry. We buy the panic and ride the recovery with a trailing stop, so a
 *   real bull run is captured in full instead of being cut short.
 * When it buys and sells: buy BTC when the Fear & Greed index drops to <=20.
 *   Sell when price falls 20% below its highest close since entry, or when a
 *   2.5x ATR hard stop hits. No greed-based exit, so winners can run.
 * When it does NOT work: in a long grinding bear market the index keeps hitting
 *   extreme fear and each dip-buy loses a little (the stop caps each loss but
 *   repeated whipsaws add up). It also misses slow steady bulls that never show
 *   extreme fear. This is a mean-reversion bet, not a trend bet.
 */
function onUpdate(ctx) {
  const price = ctx.price;
  if (!Number.isFinite(price) || price <= 0) return null;

  const fg = ctx.data('fear_greed');           // 0..100, daily sentiment
  const atr = ctx.atr(14, 1);
  if (fg == null || atr == null || atr <= 0) return null;
  const prevClose = ctx.closes.at(-2);
  if (prevClose == null) return null;

  const pos = ctx.pos(ctx.sym);
  if (pos > 0) {
    const peak = Math.max(ctx.state.peak || prevClose, prevClose);
    ctx.state.peak = peak;
    const trailStop = peak * 0.80;             // give back 20% of the run before exiting
    const hardStop = ctx.entryPx - 2.5 * atr;
    if (price <= hardStop) return { side: 'sell', qty: pos };
    if (price <= trailStop) return { side: 'sell', qty: pos };
    ctx.watch([{ side: 'sell', price: hardStop, trigger: 'below', note: '2.5x ATR stop' },
               { side: 'sell', price: trailStop, trigger: 'below', note: 'trailing -20%' }]);
    return null;
  }

  // Pure sentiment entry — no price condition to declare, so no watch for the buy.
  if (fg > 20) return null;

  const riskCash = ctx.cash * 0.01;            // risk only 1% of cash per trade
  const stopDist = 2.5 * atr;
  let qty = stopDist > 0 ? riskCash / stopDist : 0;
  const maxQty = (ctx.cash / price) * 0.95;
  if (qty > maxQty) qty = maxQty;
  if (qty <= 0) return null;
  return { side: 'buy', qty };
}
