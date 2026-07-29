import SeoHead from '../components/SeoHead'
import { SITE_ORIGIN } from '../config'

/*
 * AI-drafted starting point, not a substitute for qualified UAE legal counsel. Before relying
 * on this in production: have it reviewed against your actual free-zone license activity, DNFBP/
 * AML registration, and Central Bank / SCA guidance for the specific business model described in
 * the deck (non-custodial bullion marketplace, Stripe payments, vendor-fulfilled guaranteed
 * sell-back). Fee percentages are intentionally NOT hardcoded here — they're admin-configurable
 * and disclosed live at checkout, so this document defers to "the rate disclosed to you before
 * you confirm an order" rather than a specific number that could drift out of sync.
 */

const LAST_UPDATED = 'July 18, 2026'

const SECTIONS = [
  {
    heading: '1. Who this agreement is with, and what it covers',
    body: (
      <>
        <p>
          These Terms of Service ("Terms") govern your access to and use of the Cridora website,
          mobile experience, and related services (together, the "Platform"), operated by Cridora
          ("Cridora", "we", "us", or "our"). By creating an account, browsing listings, or placing
          an order, you agree to be bound by these Terms and by our Privacy Policy.
        </p>
        <p>
          If you do not agree to these Terms, do not create an account or use the Platform.
        </p>
      </>
    ),
  },
  {
    heading: '2. What Cridora is — and what it is not',
    body: (
      <>
        <p>
          Cridora operates an ecommerce marketplace that connects identity-verified customers ("Buyers")
          with independently owned and operated bullion dealers that have completed Cridora's
          business verification ("Vendors"). Cridora's role is limited to:
        </p>
        <ul>
          <li>verifying Buyer identity (KYC) and Vendor business credentials (KYB) before either party can transact;</li>
          <li>presenting live pricing, order quotes, and disclosed fees;</li>
          <li>processing payment through our third-party payment processor;</li>
          <li>maintaining a transaction record and facilitating the Vendor's guaranteed sell-back commitment described in Section 6; and</li>
          <li>providing dispute-support and settlement tooling between Buyers, Vendors, and Cridora.</li>
        </ul>
        <p>
          <strong>Cridora does not buy, sell, own, warehouse, insure, or take custody of any
          precious metal at any time.</strong> Physical metal is at all times held, allocated, and
          delivered by the Vendor named on your order. Cridora is not a bank, a licensed exchange
          house, a custodian, or a licensed financial or investment advisor, and nothing on the
          Platform constitutes investment, tax, or legal advice.
        </p>
      </>
    ),
  },
  {
    heading: '3. Eligibility',
    body: (
      <>
        <p>To use the Platform you must:</p>
        <ul>
          <li>be at least 18 years old and able to form a binding contract;</li>
          <li>not be located in, or a citizen or resident of, a jurisdiction subject to UAE or applicable international sanctions that would prohibit your use of the Platform;</li>
          <li>not appear on any sanctions, watch, or politically-exposed-persons list that Cridora or its Vendors are required to screen against; and</li>
          <li>provide accurate, current, and complete information during registration and identity verification, and promptly update it if it changes.</li>
        </ul>
        <p>
          Cridora may refuse to open, may suspend, or may close an account at its discretion where
          required for compliance with know-your-customer, anti-money-laundering, counter-terrorist-financing,
          or sanctions obligations, or where we reasonably suspect fraud, abuse, or a breach of these Terms.
        </p>
      </>
    ),
  },
  {
    heading: '4. Your account, verification, and compliance obligations',
    body: (
      <>
        <p>
          You are responsible for maintaining the confidentiality of your login credentials and
          for all activity that occurs under your account. Notify us immediately of any
          unauthorized use.
        </p>
        <p>
          Before you can place a buy order or request a sell-back, you must complete identity
          verification (government-issued ID, a liveness/selfie check, and proof of address where
          requested) and add and verify a bank account in your name. Cridora, acting reasonably
          and in line with its compliance program, decides when an account is fully verified;
          verification may be delayed, declined, or later revoked, including after documents have
          previously been approved, if new information comes to light.
        </p>
        <p>
          You confirm that funds used to buy on the Platform are lawfully obtained and are not
          connected to money laundering, terrorist financing, or any other unlawful activity.
        </p>
      </>
    ),
  },
  {
    heading: '5. How a purchase works',
    body: (
      <>
        <ol>
          <li>You request a quote on a specific listing; the quoted price is locked for a short, clearly displayed window.</li>
          <li>If you proceed, your order is sent to the Vendor, who must accept it within a displayed acceptance window. If the Vendor does not accept in time, or rejects the order, no charge occurs and the order is cancelled.</li>
          <li>Once the Vendor accepts, you complete payment through our payment processor within the displayed payment window. If payment is not completed in time, the order expires and is not charged.</li>
          <li>On successful payment, the metal quantity purchased is recorded as allocated to you at the accepting Vendor, and appears in your portfolio. The Vendor is responsible for holding that allocation and for its condition, authenticity, and availability.</li>
        </ol>
        <p>
          All prices, fees, and the applicable platform fee percentage are disclosed to you before
          you confirm any order. Fee rates are configurable by Cridora from time to time; the rate
          that applies to a given order is the rate disclosed to you at the time you place that
          order, not any rate shown elsewhere on the Platform (including illustrative comparison
          tools).
        </p>
      </>
    ),
  },
  {
    heading: '6. Sell-back / buyback',
    body: (
      <>
        <p>
          Subject to the Vendor's acceptance and Cridora's settlement review, you may request to
          sell allocated metal back at the then-current sell-back rate shown for that listing.
          Cridora's fee on a completed sell-back, if any, is calculated and disclosed to you as
          part of that request before you confirm it, and — where the fee is structured as a
          share of profit — is not charged at all if the sell-back results in no profit over your
          original purchase cost.
        </p>
        <p>
          The obligation to honor a sell-back at the disclosed rate is a commitment of the Vendor,
          which Cridora facilitates, monitors, and supports through its settlement and treasury
          processes. Cridora does not itself guarantee the Vendor's performance with its own
          funds, and a Vendor's insolvency, license loss, or operational failure could delay or
          prevent a sell-back being honored. Cridora will make commercially reasonable efforts to
          assist affected Buyers in that scenario but cannot guarantee a specific outcome.
        </p>
      </>
    ),
  },
  {
    heading: '7. Payments, pricing, and refunds',
    body: (
      <>
        <p>
          Card payments are processed by a third-party, PCI-compliant payment processor. Cridora
          does not store your full card details. All prices are in AED unless stated otherwise.
        </p>
        <p>
          Precious metal prices are volatile and move continuously with global markets; the price
          you lock at quote time may differ from the price available moments later or earlier.
          Cridora is not responsible for market price movements.
        </p>
        <p>
          Because an order is only charged after the Vendor accepts and metal is allocated to you,
          completed purchases are generally not refundable except where required by applicable
          law, where the Vendor is unable to fulfil an accepted order, or as otherwise stated on
          the Platform at the time of your order.
        </p>
      </>
    ),
  },
  {
    heading: '8. Vendors',
    body: (
      <>
        <p>
          Vendors are independent, third-party businesses, not employees, agents, or partners of
          Cridora. Cridora verifies Vendor business credentials before listing them (KYB) but does
          not itself grade, insure, warehouse, or guarantee the authenticity or condition of any
          Vendor's metal beyond what is stated in the applicable listing. Your contract for the
          sale, purchase, and buyback of metal is with the Vendor; Cridora is the platform,
          payment-facilitation, and settlement layer connecting you.
        </p>
      </>
    ),
  },
  {
    heading: '9. Prohibited conduct',
    body: (
      <>
        <p>You agree not to:</p>
        <ul>
          <li>provide false, misleading, or another person's identity or payment information;</li>
          <li>use the Platform for money laundering, terrorist financing, sanctions evasion, or any other unlawful purpose;</li>
          <li>attempt to circumvent, disable, or interfere with security, verification, or fraud-prevention features;</li>
          <li>scrape, reverse-engineer, or use automated means to access the Platform outside of published APIs;</li>
          <li>resell, sublicense, or misrepresent your relationship with Cridora or any Vendor; or</li>
          <li>use the Platform in a manner that could damage, disable, or impair it, or interfere with any other user's use.</li>
        </ul>
      </>
    ),
  },
  {
    heading: '10. Intellectual property',
    body: (
      <p>
        The Platform, its design, branding, and underlying software are owned by Cridora or its
        licensors and protected by applicable intellectual property laws. You are granted a
        limited, non-exclusive, non-transferable license to use the Platform for its intended
        purpose. You may not copy, modify, distribute, or create derivative works from the
        Platform without our written permission.
      </p>
    ),
  },
  {
    heading: '11. Disclaimers',
    body: (
      <p>
        The Platform is provided "as is" and "as available." To the fullest extent permitted by
        applicable law, Cridora disclaims all warranties, express or implied, including
        merchantability, fitness for a particular purpose, and non-infringement. Nothing on the
        Platform is investment, financial, tax, or legal advice, and Cridora does not recommend
        buying, holding, or selling any metal at any particular time.
      </p>
    ),
  },
  {
    heading: '12. Limitation of liability',
    body: (
      <p>
        To the fullest extent permitted by applicable law, Cridora and its officers, employees,
        and affiliates will not be liable for any indirect, incidental, special, consequential, or
        punitive damages, or for loss of profits, revenue, or data, arising from your use of the
        Platform or from any Vendor's acts or omissions. Cridora's total liability to you for any
        claim arising from these Terms or the Platform will not exceed the total fees you paid to
        Cridora (excluding amounts paid to Vendors for metal) in the twelve months before the
        claim arose. Nothing in these Terms excludes liability that cannot lawfully be excluded.
      </p>
    ),
  },
  {
    heading: '13. Indemnification',
    body: (
      <p>
        You agree to indemnify and hold Cridora harmless from any claim, loss, or expense
        (including reasonable legal fees) arising from your breach of these Terms, your misuse of
        the Platform, or your violation of any law or third-party right.
      </p>
    ),
  },
  {
    heading: '14. Suspension and termination',
    body: (
      <p>
        We may suspend or close your account, or decline a transaction, at any time where we
        reasonably believe it is necessary for compliance, risk, security, or fraud-prevention
        reasons, or where you breach these Terms. Sections of these Terms that by their nature
        should survive termination (including Sections 11–13 and 16) will continue to apply.
      </p>
    ),
  },
  {
    heading: '15. Changes to these Terms',
    body: (
      <p>
        We may update these Terms from time to time. If we make material changes, we will take
        reasonable steps to notify you (such as an in-app notice or email) before the change takes
        effect. Continuing to use the Platform after a change takes effect constitutes acceptance
        of the updated Terms.
      </p>
    ),
  },
  {
    heading: '16. Governing law and disputes',
    body: (
      <p>
        These Terms are governed by the laws of the United Arab Emirates. Any dispute arising out
        of or in connection with these Terms or the Platform will be subject to the exclusive
        jurisdiction of the competent courts of the United Arab Emirates, without prejudice to any
        mandatory consumer-protection rights you may have under applicable law.
      </p>
    ),
  },
  {
    heading: '17. Contact',
    body: (
      <p>
        Questions about these Terms can be sent to{' '}
        <a href="mailto:support@cridora.com" className="text-[var(--gold)]">support@cridora.com</a>.
      </p>
    ),
  },
]

export default function Terms() {
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'WebPage',
    name: 'Terms of Service | Cridora',
    url: `${SITE_ORIGIN}/terms`,
  }

  return (
    <>
      <SeoHead
        title="Terms of Service"
        description="The terms that govern use of the Cridora bullion marketplace, including KYC/KYB verification, how purchases and sell-backs work, fees, and liability."
        path="/terms"
        jsonLd={jsonLd}
      />
      <main className="min-w-0 overflow-x-hidden">
        <section className="pt-6 md:pt-[calc(6rem+env(safe-area-inset-top,0px))] pb-20">
          <div className="max-w-3xl mx-auto px-4 sm:px-6">
            <p className="text-[11px] tracking-[0.2em] uppercase text-[var(--gold)] mb-3">Legal</p>
            <h1 className="text-3xl sm:text-4xl font-black text-[var(--text-primary)] mb-2">
              Terms of Service
            </h1>
            <p className="text-xs text-[var(--text-dim)] mb-12">Last updated: {LAST_UPDATED}</p>

            <div className="flex flex-col gap-10">
              {SECTIONS.map((s) => (
                <div key={s.heading}>
                  <h2 className="text-sm font-bold tracking-widest uppercase text-[var(--text-primary)] mb-3">
                    {s.heading}
                  </h2>
                  <div className="text-sm text-[var(--text-soft)] leading-relaxed space-y-3 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1.5 [&_ol]:list-decimal [&_ol]:pl-5 [&_ol]:space-y-1.5 [&_li]:pl-1">
                    {s.body}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
