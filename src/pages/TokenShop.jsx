import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import { Coins, CreditCard, CheckCircle, Wrench, Gift, ShoppingBag, Check } from 'lucide-react'
import { Card } from '../components/ui/card'
import { Badge } from '../components/ui/badge'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../components/ui/tabs'

const GIFT_CARDS = [
  { id: 'amazon',    brand: 'Amazon',    logo: '📦', ratePerToken: 0.08, minTokens: 50  },
  { id: 'starbucks', brand: 'Starbucks', logo: '☕', ratePerToken: 0.10, minTokens: 30  },
  { id: 'visa',      brand: 'Visa',      logo: '💳', ratePerToken: 0.07, minTokens: 100 },
]

const PACKS = [
  { tokens: 50,  price: 4.99,  label: 'Starter Pack', popular: false },
  { tokens: 100, price: 8.99,  label: 'Campus Pack',  popular: true  },
  { tokens: 200, price: 14.99, label: 'Power Pack',   popular: false },
]

export default function TokenShop() {
  const { profile, refreshProfile, isDevMode } = useAuth()
  const [selected, setSelected] = useState(1)
  const [step, setStep] = useState('select') // 'select' | 'payment' | 'success'
  const [cardNumber, setCardNumber] = useState('')
  const [expiry, setExpiry] = useState('')
  const [cvc, setCvc] = useState('')
  const [loading, setLoading] = useState(false)
  const [devAdded, setDevAdded] = useState(null)
  const [error, setError] = useState('')

  // Gift card redemption
  const [redeemGiftCardId, setRedeemGiftCardId] = useState('amazon')
  const [redeemTokens, setRedeemTokens] = useState('100')
  const [redeemEmail, setRedeemEmail] = useState('')
  const [redeemSuccess, setRedeemSuccess] = useState(false)
  const [redeemError, setRedeemError] = useState('')

  const pack = PACKS[selected]
  const gc = GIFT_CARDS.find(g => g.id === redeemGiftCardId) || GIFT_CARDS[0]
  const redeemTokensNum = parseInt(redeemTokens || '0') || 0
  const cashValue = (redeemTokensNum * gc.ratePerToken).toFixed(2)

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
    const tokens = redeemTokensNum
    if (!tokens || tokens < gc.minTokens) { setRedeemError(`Minimum ${gc.minTokens} tokens for ${gc.brand}.`); return }
    if (tokens > (profile?.token_balance ?? 0)) { setRedeemError('Insufficient token balance.'); return }
    if (!redeemEmail) { setRedeemError('Email is required.'); return }
    setLoading(true)
    const value = (tokens * gc.ratePerToken).toFixed(2)
    const { error: err } = await supabase.from('gift_card_redemptions').insert({
      user_id: profile.id,
      brand: gc.brand,
      tokens_spent: tokens,
      cash_value: Number(value),
      delivery_email: redeemEmail,
      status: 'pending',
    })
    if (err) { setRedeemError(err.message); setLoading(false); return }
    await supabase.from('profiles').update({ token_balance: (profile.token_balance ?? 0) - tokens }).eq('id', profile.id)
    await supabase.from('token_ledger').insert({ user_id: profile.id, amount: -tokens, reason: `Redeemed ${tokens} tokens for $${value} ${gc.brand} gift card` })
    await refreshProfile()
    setRedeemSuccess(true)
    setLoading(false)
  }

  if (step === 'success') {
    return (
      <div className="min-h-screen py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-sm mx-auto text-center py-16">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle size={32} className="text-green-600" />
            </div>
            <h2 className="text-xl font-bold">Tokens Added!</h2>
            <p className="text-muted-foreground mt-1">+{pack.tokens} tokens added to your balance.</p>
            <div className="mt-4 text-3xl font-bold text-amber-500 flex items-center justify-center gap-2">
              🪙 {profile?.token_balance}
            </div>
            <Button onClick={() => setStep('select')} className="mt-6 bg-primary">
              Buy More
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'payment') {
    return (
      <div className="min-h-screen py-8">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-sm mx-auto">
            <button onClick={() => setStep('select')} className="text-sm text-muted-foreground hover:text-foreground mb-4">← Back</button>
            <Card className="p-5 mb-6 bg-foreground text-background">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm opacity-70">Buying</span>
                <CreditCard size={20} className="opacity-60" />
              </div>
              <p className="text-2xl font-bold">{pack.tokens} tokens</p>
              <p className="text-amber-400 font-semibold mt-1">${pack.price}</p>
            </Card>

            <Card className="p-4 mb-5 bg-amber-50 border-amber-200">
              <p className="text-sm text-amber-700">Demo mode — no real payment. Click Pay to credit your tokens instantly.</p>
            </Card>

            <form onSubmit={handlePurchase} className="space-y-4">
              <div>
                <Label htmlFor="card-number">Card Number</Label>
                <div className="relative mt-1">
                  <CreditCard size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="card-number"
                    type="text"
                    value={cardNumber}
                    onChange={e => setCardNumber(e.target.value.replace(/\D/g, '').slice(0, 16).replace(/(.{4})/g, '$1 ').trim())}
                    placeholder="4242 4242 4242 4242"
                    className="pl-9 font-mono"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="expiry">Expiry</Label>
                  <Input
                    id="expiry"
                    type="text"
                    value={expiry}
                    onChange={e => setExpiry(e.target.value)}
                    placeholder="MM/YY"
                    maxLength={5}
                    className="mt-1 font-mono"
                  />
                </div>
                <div>
                  <Label htmlFor="cvc">CVC</Label>
                  <Input
                    id="cvc"
                    type="text"
                    value={cvc}
                    onChange={e => setCvc(e.target.value)}
                    placeholder="123"
                    maxLength={3}
                    className="mt-1 font-mono"
                  />
                </div>
              </div>

              {error && (
                <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{error}</p>
              )}

              <Button type="submit" disabled={loading} className="w-full bg-primary">
                {loading ? 'Processing...' : `Pay $${pack.price} → Get ${pack.tokens} tokens`}
              </Button>
            </form>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Header */}
        <div className="mb-8">
          <h1 className="mb-2">Token Shop</h1>
          <p className="text-muted-foreground">Buy tokens or redeem them for gift cards</p>
        </div>

        {/* Balance Card */}
        <Card className="p-6 mb-8 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Your Balance</p>
              <div className="flex items-center gap-2">
                <span className="text-3xl">🪙</span>
                <span className="text-3xl font-semibold">
                  {isDevMode ? '∞' : (profile?.token_balance ?? 0).toLocaleString()}
                </span>
              </div>
            </div>
            <ShoppingBag className="w-12 h-12 text-primary/50" />
          </div>
        </Card>

        {/* Dev Mode */}
        {isDevMode && (
          <Card className="mb-6 p-4 bg-amber-50 border-amber-200">
            <div className="flex items-center gap-2 mb-2">
              <Wrench size={15} className="text-amber-600" />
              <span className="text-sm font-semibold text-amber-800">Dev Mode</span>
            </div>
            {devAdded ? (
              <p className="text-sm text-green-700 font-medium">+{devAdded} tokens added! Balance: {profile?.token_balance}</p>
            ) : (
              <Button
                onClick={handleDevAddTokens}
                disabled={loading}
                variant="outline"
                className="w-full border-amber-400 text-amber-700 hover:bg-amber-100"
              >
                {loading ? 'Adding...' : '⚡ Add 999 Tokens Instantly'}
              </Button>
            )}
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="buy" className="space-y-6">
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="buy" className="flex items-center gap-2">
              <CreditCard size={15} />
              Buy Tokens
            </TabsTrigger>
            <TabsTrigger value="redeem" className="flex items-center gap-2">
              <Gift size={15} />
              Redeem
            </TabsTrigger>
          </TabsList>

          {/* Buy Tab */}
          <TabsContent value="buy">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
              {PACKS.map((p, i) => (
                <Card
                  key={i}
                  className={`p-6 relative ${
                    p.popular
                      ? 'border-2 border-primary shadow-lg scale-105'
                      : 'border'
                  }`}
                >
                  {p.popular && (
                    <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-white text-xs">
                      Most Popular
                    </Badge>
                  )}
                  <div className="text-center">
                    <div className="text-4xl mb-3">🪙</div>
                    <p className="text-3xl font-semibold mb-1">{p.tokens.toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground mb-4">tokens</p>
                    <div className="mb-4">
                      <p className="text-2xl font-semibold text-primary">${p.price}</p>
                    </div>
                    <Button
                      onClick={() => { setSelected(i); setStep('payment') }}
                      className={`w-full ${p.popular ? 'bg-primary hover:bg-primary/90' : 'bg-primary/80 hover:bg-primary'}`}
                    >
                      Buy Now
                    </Button>
                  </div>
                </Card>
              ))}
            </div>

            <Card className="p-6 bg-blue-50 border-blue-200">
              <div className="flex items-start gap-3">
                <div className="text-2xl">💡</div>
                <div>
                  <h3 className="mb-2">How It Works</h3>
                  <ul className="space-y-1 text-sm text-muted-foreground">
                    <li>• Purchase tokens to offer as rewards for tasks</li>
                    <li>• Higher token rewards attract more helpers</li>
                    <li>• Tokens are held in escrow until task completion</li>
                    <li>• Unused tokens never expire</li>
                  </ul>
                </div>
              </div>
            </Card>
          </TabsContent>

          {/* Redeem Tab */}
          <TabsContent value="redeem">
            {redeemSuccess ? (
              <div className="max-w-2xl mx-auto text-center py-12">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle size={32} className="text-green-600" />
                </div>
                <h3 className="text-lg font-bold">Redemption submitted!</h3>
                <p className="text-muted-foreground mt-1">Your gift card will be sent to {redeemEmail} within 24–48 hours.</p>
                <Button onClick={() => setRedeemSuccess(false)} className="mt-5 bg-primary">
                  Done
                </Button>
              </div>
            ) : (
              <div className="max-w-2xl mx-auto space-y-6">

                {/* Gift Card Selector */}
                <Card className="p-6">
                  <h3 className="mb-4">Select Gift Card</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {GIFT_CARDS.map(g => (
                      <Button
                        key={g.id}
                        type="button"
                        variant={redeemGiftCardId === g.id ? 'default' : 'outline'}
                        className={`relative h-24 flex flex-col items-center justify-center gap-1 ${
                          redeemGiftCardId === g.id ? 'bg-primary hover:bg-primary/90' : ''
                        }`}
                        onClick={() => setRedeemGiftCardId(g.id)}
                      >
                        <span className="text-3xl">{g.logo}</span>
                        <span className="text-sm">{g.brand}</span>
                        {redeemGiftCardId === g.id && (
                          <Check size={14} className="absolute top-2 right-2" />
                        )}
                      </Button>
                    ))}
                  </div>
                </Card>

                {/* Redemption Amount */}
                <Card className="p-6">
                  <h3 className="mb-4">Redemption Amount</h3>
                  <form onSubmit={handleRedeem} className="space-y-4">
                    <div>
                      <Label htmlFor="redeem-tokens">Tokens to Redeem</Label>
                      <div className="relative mt-2">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg">🪙</span>
                        <Input
                          id="redeem-tokens"
                          type="number"
                          value={redeemTokens}
                          onChange={e => setRedeemTokens(e.target.value)}
                          placeholder="100"
                          min={gc.minTokens}
                          step="10"
                          className="pl-10"
                        />
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">Minimum: {gc.minTokens} tokens</p>
                    </div>

                    <div className="p-4 bg-primary/5 rounded-lg border border-primary/20">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm text-muted-foreground">Token Value:</span>
                        <span className="font-semibold">🪙 {redeemTokensNum.toLocaleString()}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-muted-foreground">Gift Card Value:</span>
                        <span className="text-xl font-semibold text-primary">${cashValue}</span>
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="redeem-email">Delivery Email</Label>
                      <Input
                        id="redeem-email"
                        type="email"
                        value={redeemEmail}
                        onChange={e => setRedeemEmail(e.target.value)}
                        placeholder="your@email.edu"
                        className="mt-2"
                      />
                    </div>

                    {redeemError && (
                      <p className="text-sm text-destructive bg-destructive/10 rounded-lg px-3 py-2">{redeemError}</p>
                    )}

                    <Button
                      type="submit"
                      disabled={loading || !redeemEmail || redeemTokensNum < gc.minTokens || redeemTokensNum > (profile?.token_balance ?? 0)}
                      className="w-full bg-primary hover:bg-primary/90"
                    >
                      <Gift size={16} className="mr-2" />
                      {loading ? 'Processing...' : 'Redeem for Gift Card'}
                    </Button>
                  </form>
                </Card>

                {/* Info */}
                <Card className="p-6 bg-amber-50 border-amber-200">
                  <div className="flex items-start gap-3">
                    <div className="text-2xl">📧</div>
                    <div>
                      <h4 className="mb-2">Delivery Information</h4>
                      <p className="text-sm text-muted-foreground">
                        Gift cards are delivered via email within 24 hours. Check your spam folder if you don't see it. For questions, contact support.
                      </p>
                    </div>
                  </div>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
