export default function PricingPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold">Pricing</h1>
      <div className="grid md:grid-cols-3 gap-4">
        {[
          { name: 'Free', price: '$0', note: 'Watermark on exports' },
          { name: 'Pro', price: '$9/mo', note: 'HD exports' },
          { name: 'Studio', price: 'Contact', note: 'Teams & SSO' },
        ].map(t => (
          <div key={t.name} className="border rounded-lg p-4 bg-white">
            <div className="text-xl font-semibold">{t.name}</div>
            <div className="text-2xl">{t.price}</div>
            <p className="text-gray-600 text-sm">{t.note}</p>
            <button className="mt-4 w-full rounded bg-gray-900 text-white py-2">Checkout (stub)</button>
          </div>
        ))}
      </div>
      <p className="text-sm text-gray-600">Free plan exports include a watermark.</p>
    </div>
  )
}
