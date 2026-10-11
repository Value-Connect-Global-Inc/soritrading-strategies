/*
 * @coinsori-strategy v1
 * name: Sentiment Gated RSI Bollinger Mean Reversion ETH
 * ex: binance
 * syms: ETH/USDT
 * interval: 1h
 * cash: 10000
 *
 * Why this strategy: Exploits short-term oversold conditions in ETH/USDT during fearful market regimes, filtering entries using Fear & Greed sentiment and Bollinger Bands.
 * When it buys and sells: Buys when Fear & Greed is below neutral, RSI(14) is oversold (<35), and price touches the lower Bollinger Band. Sells when RSI recovers above 55 or price reaches the upper Bollinger Band.
 * When it does NOT work: Suffers in prolonged structural bear markets where sentiment stays low and assets drift downwards without meaningful bounces.
 */

function onUpdate(ctx) {
    const p = ctx.price;
    const pos = ctx.position;
    
    // Read indicators
    const rsi1 = ctx.rsi(14, 1);
    const rsi2 = ctx.rsi(14, 2);
    const bb = ctx.bb(20, 2, 1);
    const fg = ctx.data('fg');
    
    if (rsi1 == null || rsi2 == null || bb == null) return null;
    
    const lower = bb.lower;
    const upper = bb.upper;
    
    // Sentiment filter: require fg <= 50 if available, else allow
    const sentimentOk = (fg == null || fg <= 50);
    
    // Watch display for live / paper
    ctx.watch([
        { side: 'buy', price: lower, trigger: 'below', note: 'BB Lower + RSI < 35', conds: [
            { label: 'RSI(14)', now: rsi1, op: '<', ref: 35, closed: true },
            { label: 'Sentiment FG', now: fg != null ? fg : 50, op: '<=', ref: 50, closed: true }
        ]},
        { side: 'sell', price: upper, trigger: 'above', note: 'BB Upper / RSI > 55' }
    ]);
    
    if (pos <= 0) {
        // Buy condition: oversold RSI touching lower BB under supportive sentiment
        if (sentimentOk && rsi1 < 35 && p <= lower * 1.005) {
            const qty = (ctx.cash / p) * 0.99;
            if (qty > 0) return { side: 'buy', qty };
        }
    } else {
        // Sell condition: profit target or RSI recovery
        if (rsi1 > 55 || p >= upper * 0.995) {
            return { side: 'sell', qty: pos };
        }
    }
    
    return null;
}
