/*
 * @coinsori-strategy v1
 * name: CryptoTrendBasket1d v3-VIX (panic gate test)
 * ex: binance
 * syms: BTC/USDT, ETH/USDT, SOL/USDT, BNB/USDT
 * interval: 1d
 * cash: 10000
 *
 * Why this strategy: the v3 momentum basket (30d + 90d trend entry, -3% momentum exit, 3x ATR trail) is
 * robust but its exits are lagging price signals — in a macro panic every coin drops together BEFORE the
 * individual momentum turns negative. Adding a leading macro gate: when US stock-market volatility (VIX)
 * spikes above 30, exit everything immediately, because that regime historically precedes deep crypto
 * drawdowns. The basket then re-enters coins normally as their trends recover.
 * When it buys and sells: each coin independently buys when 30-day momentum is > 0.5% AND the 90-day
 * trend is still up. It sells when 30-day momentum < -3%, price falls 3x ATR below its peak, OR VIX > 30
 * (macro panic — exit all coins regardless of their own momentum).
 * When it does NOT work: if VIX spikes while crypto keeps rallying (decoupling), the gate exits early and
 * misses the move, then re-enters at a worse price. A panic that turns out to be a dip costs the spread
 * and re-entry. VIX data is published with a lag, so the live gate acts one day late.
 */
function onUpdate(ctx) {
  const sym = ctx.sym;
  const px = ctx.closes.at(-2); // last CLOSED bar so backtest, paper and live agree
  if (px == null) return null;
  const mom30 = ctx.change(30, 1); // 30-day momentum on closed bars
  const mom90 = ctx.change(90, 1); // 90-day trend on closed bars — regime confirmation
  const atr = ctx.atr(14, 1);
  const vix = ctx.data('base_vix'); // US stock-market volatility — leading macro panic signal
  if (mom30 == null || mom90 == null || atr == null || atr <= 0) return null;
  const momLevel = px / (1 + mom30); // the close 30 days ago
  const panic = vix != null && vix > 30; // macro panic — exit everything, momentum is lagging

  const pos = ctx.pos(sym);
  const st = ctx.state;
  if (!st.peak) st.peak = {}; // ctx is shared across all symbols — keep per-symbol peak
  const peak = st.peak[sym] != null ? Math.max(st.peak[sym], px) : px;
  st.peak[sym] = peak;
  const trailStop = peak - 3 * atr; // 3 ATR below the peak = let winners run, cut reversals

  if (pos > 0) {
    ctx.watch([{ side: 'sell', price: trailStop, trigger: 'below', note: '3x ATR trail' },
               { side: 'sell', price: momLevel * 0.97, trigger: 'below', note: '30d momentum < -3%' },
               { side: 'sell', price: 30, trigger: 'above', note: 'VIX panic',
                 conds: [{ label: 'VIX now', now: vix, op: '>', ref: 30, closed: true }] }]);
    if (mom30 < -0.03 || px < trailStop || panic) { // exit on trend loss OR macro panic
      st.peak[sym] = null;
      return { side: 'sell', qty: pos };
    }
    return null;
  }

  ctx.watch([{ side: 'buy', price: momLevel * 1.005, trigger: 'above', note: '30d mom > 0.5% & 90d up' }]);
  if (mom30 > 0.005 && mom90 > 0) { // two timescales confirm a trend, not a noise blip
    const qty = (ctx.cash / px) * 0.25; // cap each coin at 25% of the account
    if (qty <= 0) return null;
    st.peak[sym] = px;
    return { side: 'buy', qty: qty };
  }
  return null;
}
