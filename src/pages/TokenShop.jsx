import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Coins, CreditCard, CheckCircle, Wrench, Gift, ChevronRight } from 'lucide-react'

const GIFT_CARDS = [
  { brand: 'Amazon',    emoji: '📦', ratePerToken: 0.08, minTokens: 50  },
  { brand: 'Starbucks', emoji: '☕', ratePerToken: 0.10, minTokens: 30  },
  { brand: 'Visa',      emoji: '💳', ratePerToken: 0.07, minTokens: 100 },
]

const PACKS = [
  { tokens: 50, price: 4.99, label: 'Starter Pack', popular: false },
  { tokens: 100, price: 8.99, label: 'Campus Pack', popular: true },
  { tokens: 200, price: 14.99, label: 'Power Pack', popular: false },
]

export default function TokenShop() {
  const { profile, refreshProfile, isDevMode } = useAuth()
  const [selected, setSelected] = useState(1)
  const [step, setStep] = useState('select') // 'select' | 'payment' | 'success' | 'redeem'
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [loading, setLoading] = useState(false)
  const [devAdded, setDevAdded] = useState(null)
  const [error, setError] = useState('')

  // Gift card redemption
  const [redeemBrand, setRedeemBrand] = useState(0)
  const [redeemTokens, setRedeemTokens] = useState('')
  const [redeemEmail, setRedeemEmail] = useState('')
  const [redeemSuccess, setRedeemSuccess] = useState(false)
  const [redeemError, setRedeemError] = useState('')

  const pack = PACKS[selected]

  async function handleDevAddTokens() {
    setLoading(true)
    const amount = 999
    await supabase
      .from('profiles')
      .update({ token_balance: (profile?.token_balance ?? 0) + amount })
      .eq('id', profile.id)
    await supabase.from('token_ledger').insert({
      user_id: profile.id,
      amount,
      reason: 'Dev mode token injection (+999)',
    })
    await refreshProfile()
    setDevAdded(amount)
    setLoading(false)
  }

  async function handlePurchase(e) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      if (!profile?.id) throw new Error('Profile not loaded. Please refresh and try again.')

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ token_balance: (profile.token_balance ?? 0) + pack.tokens })
        .eq('id', profile.id)

      if (updateError) throw updateError

      await supabase.from('token_ledger').insert({
        user_id: profile.id,
        amount: pack.tokens,
        reason: `Purchased ${pack.tokens}-token pack ($${pack.price})`,
      })

      await refreshProfile()
      setStep('success')
    } catch (err) {
      setError(err.message || 'Something went wrong. Try again.')
    } finally {
      setLoading(false)
    }
  }

  async function handleRedeem(e) {
    e.preventDefault()
    setRedeemError('')
    const gc = GIFT_CARDS[redeemBrand]
    const tokens = Number(redeemTokens)
    if (!tokens || tokens < gc.minTokens) { setRedeemError(`Minimum ${gc.minTokens} tokens for ${gc.brand}.`); return }
    if (tokens > (profile?.token_balance ?? 0)) { setRedeemError('Insufficient token balance.'); return }
    if (!redeemEmail) { setRedeemError('Email is required.'); return }
    setLoading(true)
    const cashValue = (tokens * gc.ratePerToken).toFixed(2)
    const { error: err } = await supabase.from('gift_card_redemptions').insert({
      user_id: profile.id,
      brand: gc.brand,
      tokens_spent: tokens,
      cash_value: Number(cashValue),
      delivery_email: redeemEmail,
      status: 'pending',
    })
    if (err) { setRedeemError(err.message); setLoading(false); return }
    await supabase.from('profiles').update({ token_balance: (profile.token_balance ?? 0) - tokens }).eq('id', profile.id)
    await supabase.from('token_ledger').insert({ user_id: profile.id, amount: -tokens, reason: `Redeemed ${tokens} tokens for $${cashValue} ${gc.brand} gift card` })
    await refreshProfile()
    setRedeemSuccess(true)
    setLoading(false)
  }

  if (step === 'redeem') {
    const gc = GIFT_CARDS[redeemBrand]
    const tokens = Number(redeemTokens) || 0
    const cashValue = (tokens * gc.ratePerToken).toFixed(2)
    return (
      <div className="max-w-sm mx-auto px-4 py-6">
        <button onClick={() => { setStep('select'); setRedeemSuccess(false); setRedeemError('') }}
          className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Back</button>
        <h2 className="text-xl font-bold text-[#1A1A2E] mb-1">Redeem for Gift Card</h2>
        <p className="text-sm text-gray-500 mb-5">Balance: <span className="font-bold text-[#F5A623]">{profile?.token_balance ?? 0} tokens</span></p>

        {redeemSuccess ? (
          <div className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h3 className="text-lg font-bold text-gray-900">Redemption submitted!</h3>
            <p className="text-sm text-gray-500 mt-1">Your gift card will be sent to {redeemEmail} within 24–48 hours.</p>
            <button onClick={() => { setStep('select'); setRedeemSuccess(false) }}
              className="mt-5 px-6 py-2.5 bg-[#C41230] text-white rounded-xl font-semibold hover:bg-[#a00f28] transition-colors">
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleRedeem} className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-2">Gift card brand</label>
              <div className="grid grid-cols-3 gap-2">
                {GIFT_CARDS.map((gc, i) => (
                  <button key={i} type="button" onClick={() => setRedeemBrand(i)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${redeemBrand === i ? 'border-[#C41230] bg-red-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <span className="text-2xl">{gc.emoji}</span>
                    <span className="text-xs font-semibold text-gray-700">{gc.brand}</span>
                    <span className="text-[10px] text-gray-400">{(gc.ratePerToken * 100).toFixed(0)}¢/token</span>
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-1">Min {gc.minTokens} tokens · {(gc.ratePerToken * 100).toFixed(0)}¢ per token</p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Tokens to redeem</label>
              <input type="number" min={gc.minTokens} max={profile?.token_balance ?? 0} value={redeemTokens}
                onChange={e => setRedeemTokens(e.target.value)} placeholder={`Min ${gc.minTokens}`}
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
              {tokens >= gc.minTokens && (
                <p className="text-xs text-green-600 mt-1 font-medium">= ${cashValue} {gc.brand} gift card</p>
              )}
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-700 block mb-1">Delivery email</label>
              <input type="email" value={redeemEmail} onChange={e => setRedeemEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-[#C41230]" />
            </div>

            {redeemError && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{redeemError}</p>}

            <button type="submit" disabled={loading}
              className="w-full py-3 bg-[#C41230] text-white rounded-xl font-semibold hover:bg-[#a00f28] transition-colors disabled:opacity-60">
              {loading ? 'Processing...' : `Redeem ${tokens || '—'} tokens → $${cashValue} ${gc.brand}`}
            </button>
          </form>
        )}
      </div>
    )
  }

  if (step === 'success') {
    return (
      <div className="max-w-sm mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle size={32} className="text-green-600" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Tokens Added!</h2>
        <p className="text-gray-500 mt-1">+{pack.tokens} tokens added to your balance.</p>
        <div className="mt-4 text-3xl font-bold text-[#F5A623] flex items-center justify-center gap-2">
          <Coins size={28} />
          {profile?.token_balance}
        </div>
        <button
          onClick={() => setStep('select')}
          className="mt-6 px-6 py-2.5 bg-[#C41230] text-white rounded-xl font-semibold hover:bg-[#a00f28] transition-colors"
        >
          Buy More
        </button>
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="max-w-sm mx-auto px-4 py-6">
        <button onClick={() => setStep('select')} className="text-sm text-gray-500 hover:text-gray-700 mb-4">← Back</button>
        <div className="bg-[#1A1A2E] rounded-2xl p-5 mb-6 text-white">
          <div className="flex items-center justify-between mb-1">
            <span className="text-sm opacity-70">Buying</span>
            <CreditCard size={20} className="opacity-60" />
          </div>
          <p className="text-2xl font-bold">{pack.tokens} tokens</p>
          <p className="text-[#F5A623] font-semibold mt-1">${pack.price}</p>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 mb-5 text-sm text-yellow-700">
          Demo mode — no real payment. Click Pay to credit your tokens instantly.
        </div>

        <form onSubmit={handlePurchase} className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-700">Card Number</label>
            <div className="relative mt-1">
              <CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim())}
                placeholder="4242 4242 4242 4242"
                className="w-full pl-9 pr-3 py-2.5 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C41230]"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-semibold text-gray-700">Expiry</label>
              <input
                type="text"
                value={expiry}
                onChange={e => setExpiry(e.target.value)}
                placeholder="MM/YY"
                maxLength={5}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C41230]"
              />
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700">CVC</label>
              <input
                type="text"
                value={cvc}
                onChange={e => setCvc(e.target.value)}
                placeholder="123"
                maxLength={3}
                className="mt-1 w-full px-3 py-2.5 rounded-lg border border-gray-300 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#C41230]"
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-[#C41230] text-white rounded-xl font-semibold hover:bg-[#a00f28] transition-colors disabled:opacity-60"
          >
            {loading ? 'Processing...' : `Pay $${pack.price} → Get ${pack.tokens} tokens`}
          </button>
        </form>
      </div>
    )
  }

  return (
    <div className="max-w-sm mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1A1A2E] mb-1">Token Shop</h1>
      <p className="text-gray-500 text-sm mb-6">
        Current balance: <span className="font-bold text-[#F5A623]">{profile?.token_balance ?? 0} tokens</span>
      </p>

      {/* Dev Mode instant tokens */}
      {isDevMode && (
        <div className="mb-5 bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Wrench size={15} className="text-amber-600" />
            <span className="text-sm font-semibold text-amber-800">Dev Mode</span>
          </div>
          {devAdded ? (
            <p className="text-sm text-green-700 font-medium">+{devAdded} tokens added! Balance: {profile?.token_balance}</p>
          ) : (
            <button
              onClick={handleDevAddTokens}
              disabled={loading}
              className="w-full py-2.5 bg-amber-500 text-white rounded-xl font-semibold text-sm hover:bg-amber-600 transition-colors disabled:opacity-60"
            >
              {loading ? 'Adding...' : '⚡ Add 999 Tokens Instantly'}
            </button>
          )}
        </div>
      )}

      <div className="space-y-3 mb-6">
        {PACKS.map((p, i) => (
          <button
            key={i}
            onClick={() => setSelected(i)}
            className={`w-full rounded-2xl border-2 p-4 text-left transition-all ${
              selected === i
                ? 'border-[#C41230] bg-red-50'
                : 'border-gray-200 bg-white hover:border-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-gray-900">{p.label}</p>
                  {p.popular && (
                    <span className="text-xs bg-[#C41230] text-white px-2 py-0.5 rounded-full">Popular</span>
                  )}
                </div>
                <p className="flex items-center gap-1 text-[#F5A623] font-bold text-lg mt-0.5">
                  <Coins size={16} />
                  {p.tokens} tokens
                </p>
              </div>
              <div className="text-right">
                <p className="text-xl font-bold text-gray-900">${p.price}</p>
                <p className="text-xs text-gray-400">${(p.price / p.tokens * 10).toFixed(1)}¢/token</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      <button
        onClick={() => setStep('payment')}
        className="w-full py-3 bg-[#C41230] text-white rounded-xl font-semibold hover:bg-[#a00f28] transition-colors"
      >
        Buy {pack.tokens} tokens for ${pack.price}
      </button>

      {/* Gift card redemption */}
      <div className="mt-6 border-t border-gray-100 pt-5">
        <div className="flex items-center gap-2 mb-3">
          <Gift size={15} className="text-purple-500" />
          <p className="text-sm font-semibold text-gray-700">Redeem tokens for gift cards</p>
        </div>
        <div className="space-y-2">
          {GIFT_CARDS.map((gc, i) => (
            <button key={i} type="button"
              onClick={() => { setRedeemBrand(i); setStep('redeem') }}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 bg-white hover:border-purple-300 hover:bg-purple-50 transition-colors">
              <div className="flex items-center gap-3">
                <span className="text-xl">{gc.emoji}</span>
                <div className="text-left">
                  <p className="text-sm font-semibold text-gray-800">{gc.brand} Gift Card</p>
                  <p className="text-xs text-gray-400">{(gc.ratePerToken * 100).toFixed(0)}¢ per token · min {gc.minTokens} tokens</p>
                </div>
              </div>
              <ChevronRight size={15} className="text-gray-400" />
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
