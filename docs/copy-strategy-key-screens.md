# Cridora Copy Strategy — Key Screens (v1)

**Scope:** Landing/Home, Marketplace, Buy flow (quote → confirm), Checkout/Payment, Sign In/Sign Up, Order history, FAQ.
**Source of current copy:** live extraction from `frontend/src` (file:line references included per item).
**Status:** strategy document only — no code changed. Hand this to engineering as the content spec for the next copy pass.

---

## 0. Brand Voice & Global Rules

**Voice pillars:** Premium · Calm · Precise · Human · Confident. We sound like a private bank explaining gold, not a marketplace selling it.

**Sentence rules**
- Max ~14 words per sentence in UI copy. One idea per sentence.
- Lead with the customer benefit, not the platform feature ("Your gold, verified before you pay" not "We use KYB verification").
- Numbers over adjectives ("Verified in 5–10 minutes" beats "Fast verification").
- Never say "cheap," "discount," or "deal" — say "fair price," "live rate," "transparent pricing."

**The "never use" list (per brief) — global find/replace targets**

| Banned term | Where it currently appears | Replacement |
|---|---|---|
| "Fee" (as a standalone word in customer-facing UI) | `Cridora Service Fee` (Marketplace.jsx:817, Payment.jsx:523), `PSP fee` (Payment.jsx), `Fee breakdown` (Payment.jsx:32), `packing fees`, `delivery fees` | **"Cridora Assurance"** (core %), **"Secure Payment Handling"** (PSP pass-through), **"White-Glove Delivery Service"** (packing/delivery), **"What's Included"** (replaces "Fee breakdown") |
| "Charge" | `heroCompare.js`: "Bank processing + fixed charges", "Making & retail charges" | "cost," "premium built into the price" |
| "Commission" | not currently used customer-facing — keep it that way | n/a |

**Important nuance for engineering/legal:** VAT invoices and Stripe/PSP receipts may have UAE tax-compliance requirements to itemize charges clearly. Recommend: use premium language in the *decision-making* UI (quote, marketplace, hero), but on the **final tax invoice/receipt PDF**, show `Cridora Assurance (Service Fee)` in parentheses once — this keeps the emotional framing everywhere it influences behavior, while staying audit-clean where it's a legal document, not a persuasion surface.

**Global psychological framework applied throughout:**
- **Loss aversion** — "Your price is locked" beats "Get a quote" (loss of a good price feels worse than gaining one).
- **Social proof** — vendor rating counts, "X verified vendors," reviewed counts, not fake urgency.
- **Commitment & consistency** — multi-step flows narrate progress ("Step 2 of 3: Confirm") so users feel invested in finishing.
- **Cognitive fluency** — short words, consistent terminology (never alternate "Assurance" and "fee" for the same concept).
- **Reciprocity** — give value before asking ("See today's live rate — free, no account needed" before requiring signup).
- **Genuine scarcity only** — "12 units left at this vendor" (real inventory), never countdown timers on price.

---

## 1. Landing / Home

### 1.1 Hero

**Current** (`Home.jsx:269-290`)
> H1: "Buy Physical Gold from Verified UAE Bullion Dealers."
> Sub: "A trusted marketplace connecting global investors to UAE's gold market. See why Cridora's live dealer rates beat typical OGold, SaveGold, bank and retail all-in costs — instantly on the right."
> Badges: "UAE-licensed partners" · "KYC · KYB · AML · Stripe"
> CTAs: "Browse all products" / "How It Works"

**Improved**
> Eyebrow: "UAE's trusted gold marketplace"
> H1: **"Own Real Gold. Verified. Insured. Yours."**
> Sub: **"Buy physical gold and silver from licensed UAE dealers — at live, transparent rates. Every gram verified before you pay. Every gram yours to keep or sell back, anytime."**
> Badges: "Licensed UAE dealers" · "Identity-verified vendors" · "Bank-grade payment security"
> CTAs: **"See Today's Gold Rate"** (primary) / **"How It Works"** (secondary)

**Why it's better**
- Original H1 is a feature statement ("verified dealers"); new H1 is an outcome statement ("real gold, yours") — outcomes convert better than process claims.
- "Own Real Gold" reframes the transaction as ownership/investment from word one, matching the brief's "investor, not customer" goal.
- Replaced acronym-heavy badges (KYC/KYB/AML/Stripe — meaningless to a first-time visitor) with plain-English trust statements. Acronyms depress comprehension speed (cognitive fluency loss) even though they're accurate.
- Primary CTA changed from "Browse all products" (low commitment, catalog-browsing framing) to "See Today's Gold Rate" — curiosity + immediate utility, and it's the natural first micro-commitment before buying (commitment & consistency).
- Dropped the direct competitor callouts ("beats OGold, SaveGold...") from the hero — comparison claims in the very first sentence undercut premium positioning (Apple/Tesla never open with "cheaper than X"). Comparison content is kept, just moved to a dedicated comparison section/tool lower down where it's evidence, not the opener.

**SEO improvements**
- H1 now contains "own," "gold," "verified" — natural language matching "buy gold UAE," "gold ownership," "secure gold investment" intents without stuffing.
- Meta title/description should carry the exact-match terms instead: `title="Buy Physical Gold Online in UAE | Verified Dealers — Cridora"`, `description="Buy 24K gold bars and coins online in the UAE at live, transparent rates from licensed bullion dealers. 100% verified, fully insured, sell back anytime."` — keeps "buy gold online UAE," "gold bars UAE," "gold bullion Dubai" in the crawlable meta layer while the visible H1 stays clean and emotional.

**Psychological principles:** premium positioning, cognitive fluency, loss aversion ("yours to keep"), commitment & consistency (low-friction first CTA).

**Conversion impact:** Clearer, faster-to-parse value prop at the top of funnel; a curiosity-driven primary CTA ("see rate") has a lower activation barrier than "browse products," which should lift hero click-through.

**Alternative premium version**
> H1: **"Gold Ownership, Made Effortless."**
> Sub: **"Cridora connects you directly to licensed UAE bullion dealers — live rates, verified gold, guaranteed buy-back. No banks. No guesswork."**

---

### 1.2 Trust badges (`PublicTrustBar.jsx`)

**Current**
> "UAE-licensed bullion partners" · "Customer KYC before any trade" · "Vendor KYB authenticated" · "AML-aligned checks & records" · "Stripe-secured card checkout" · "No platform metal custody"

**Improved**
> "Licensed UAE gold dealers only" · "Your identity verified before every trade" · "Every dealer background-checked" · "Full compliance with UAE financial regulations" · "Bank-grade encrypted payments" · "Your gold, held by the dealer — never by us"

**Why it's better** — Same six guarantees, translated from compliance jargon (KYC/KYB/AML/PSP) into what each one *means for the buyer*. "No platform metal custody" sounds evasive to a newcomer; "Your gold, held by the dealer — never by us" turns the same fact into a transparency flex.

**SEO improvements** — Natural inclusion of "UAE bullion dealers," "gold dealers," "UAE financial regulations" for "trusted gold marketplace UAE" / "UAE bullion dealers" intent.

**Psychological principles:** trust-building, transparency (explicit custody statement pre-empts the #1 fear — "is my gold real / who's holding it"), reduces need for user to ask "is this safe?" before they've even scrolled.

**Conversion impact:** Placed directly under the hero, this is the first objection-handling moment — plain language here reduces bounce from skeptical first-time visitors.

---

### 1.3 Hero "Quick Gold Estimate" panel (`HeroBuyPanel.jsx`)

**Current**
> "Quick gold estimate" · placeholder "Or enter custom grams" · "Cridora (from)" · "Secure Purchase Service {pct}% (AED …)" · "Lower all-in than listed peers — save up to AED … on this size" · "+ processing" · CTA "Purchase — choose product"

**Improved**
> Heading: **"What Would Your Gold Be Worth Today?"**
> Placeholder: **"Enter grams, or choose a quick amount"**
> Price label: **"Your estimated price with Cridora"**
> Value line: **"Includes Cridora Assurance — verification, secure escrow-style handling, and guaranteed buy-back"**
> Savings line: **"Typically AED {x} less than banks and retail — before you even compare"**
> CTA: **"Get This Rate — Choose a Product"**

**Why it's better** — "Quick gold estimate" is functional but flat; the question framing ("What would your gold be worth today?") invites interaction rather than describing a widget. "Secure Purchase Service {pct}%" as a raw percentage next to a price reads like a hidden charge; folding it into one plain sentence ("Includes Cridora Assurance — verification, escrow-style handling, guaranteed buy-back") reframes the same number as a bundle of protections, per the brief's pricing-language rule.

**SEO improvements** — n/a (interactive widget, not indexed page content), but surrounding static copy should still carry "gold price UAE," "gold rate today UAE."

**Psychological principles:** reciprocity (free instant value estimate before any signup), loss aversion (showing the savings number make *not* buying here feel like leaving money on the table), premium reframing of pricing.

**Conversion impact:** This widget is the top-of-funnel engagement hook — an inviting question plus a concrete AED savings number should increase interaction rate and downstream click-through to the marketplace.

---

### 1.4 "Why Cridora" value props (`Home.jsx:449-496`)

**Current titles:** "Non-Custodial Architecture" · "Real-Time Vendor Quotes" · "Instant Purchase & Settlement" · "Guaranteed Sell-Back" · "Per-Vendor Fund Isolation" · "Designed for Global Access"

**Improved titles + one-line subs:**
1. **"Your Gold, Never Ours"** — "We connect you to dealers. We never hold or trade your metal."
2. **"Live Prices, Always"** — "Rates update in real time — no stale quotes, no surprises at checkout."
3. **"Buy in Minutes"** — "From quote to ownership in one secure, guided flow."
4. **"We'll Buy It Back — Guaranteed"** — "Sell back to the same vendor at a transparent, pre-agreed rate. Anytime."
5. **"Every Dealer's Funds, Kept Separate"** — "Your payment is isolated per vendor — one dealer's issue never touches your funds."
6. **"Invest From Anywhere"** — "UAE residency not required. Global investors, welcome."

**Why it's better** — Engineering/compliance terms ("Non-Custodial Architecture," "Per-Vendor Fund Isolation") are accurate but require the reader to already understand fintech risk models. Rewritten titles state the *benefit* first; the original technical term now lives as supporting proof in the subhead, which is exactly how Stripe and Emirates NBD write for retail investors (technical trust signal, plain-English headline).

**SEO improvements** — "Guaranteed Sell-Back" / "We'll Buy It Back" naturally supports "sell gold back UAE" and "gold liquidity" long-tail queries increasingly searched alongside "gold investment UAE."

**Psychological principles:** loss aversion ("guaranteed buy-back" removes the fear of being stuck holding an illiquid asset), trust-building, simplicity.

**Conversion impact:** These six cards are the primary "why buy here vs elsewhere" answer on the page — clearer benefit-first titles increase the odds a scanning (non-reading) visitor absorbs at least 2–3 of them before leaving.

---

### 1.5 "The Process" (`Home.jsx:691-718`)

**Current steps:** "Complete KYC Verification" · "Browse Real-Time Listings" · "Purchase with Confidence" · "Hold, Track & Sell Back"

**Improved:**
1. **"Verify Once"** — "Quick identity check, done in minutes. It's what keeps every trade on Cridora safe."
2. **"Compare Live Rates"** — "Browse real-time prices from licensed dealers, side by side."
3. **"Buy With Confidence"** — "Your price is locked the moment you confirm. No last-minute changes."
4. **"Track, Hold or Sell"** — "Watch your gold's value grow, or sell it back whenever you're ready."

**Why it's better** — Same four-step architecture (already good UX), softened into action verbs a first-time investor would use themselves ("Verify Once" vs "Complete KYC Verification" — avoids "KYC" acronym at the top of a persuasion section entirely).

**Psychological principles:** commitment & consistency (four small, clearly-labeled steps reduce the perceived size of the task — a classic "foot in the door" structure), simplicity.

**Conversion impact:** A four-step visual "how it works" is proven to reduce pre-signup anxiety; plain verbs make it skimmable in under 5 seconds, which is roughly the attention budget a scrolling visitor gives this section.

---

### 1.6 Compliance & Security section (`Home.jsx:739-763`)

**Current:** eyebrow "Compliance & Security" · H2 "Trust Is Not a Feature. It's the Foundation." · cards "Verified Vendors Only," "User Protection," "Platform Security"

**Improved:** keep the H2 — it's genuinely strong, on-brand, and quotable. Sharpen the three cards:
- **"Every Dealer Is Verified"** — "Background-checked, licensed, and continuously monitored."
- **"Your Funds Are Protected"** — "Payments are held securely until your order is confirmed by the vendor."
- **"Bank-Grade Security, Always On"** — "Encrypted payments, monitored 24/7, built on the same infrastructure banks trust."

**Why it's better** — "User Protection" and "Platform Security" as card titles are abstract nouns with no image attached; investors respond to concrete claims ("held securely until confirmed") far more than to labels.

**Psychological principles:** trust-building, emotional reassurance ("your funds are protected" directly answers the brief's target thought — "my investment is protected").

**Conversion impact:** This is the section most likely to be read by a hesitant, higher-value buyer right before they decide to sign up — specificity here should measurably reduce checkout abandonment for first-time buyers.

---

### 1.7 Footer CTA (`Home.jsx:813-837`)

**Current:** "Start Today" / "Own Real Metal." / "From Anywhere." / "Open Marketplace" / "For Vendors"

**Improved:**
> Eyebrow: **"Ready When You Are"**
> H2: **"Your First Gram of Gold Is a Click Away."**
> Sub: **"Join investors across the UAE and beyond who trust Cridora for transparent, secure gold ownership."**
> CTA: **"Explore Today's Rates"** (primary) / **"Become a Vendor"** (secondary)

**Why it's better** — "Start Today / Own Real Metal / From Anywhere" reads as three disconnected fragments; consolidating into one confident sentence with a concrete image ("your first gram") is more memorable and mirrors Airbnb's closing-CTA pattern (specific, personal, low-pressure).

**Psychological principles:** social proof ("investors... trust Cridora"), premium positioning, low-pressure close (no urgency/scarcity gimmick, consistent with brief).

**Conversion impact:** Footer CTA is the last-chance conversion moment on the page; a warmer, more specific close typically outperforms a generic "Open Marketplace" button in click-through.

---

### 1.8 Invest Now bar (`InvestNowBar.jsx`)

**Current:** "Start Investing Now" · "Buy verified physical gold from UAE dealers in minutes." · "Buy Gold Now"

**Improved:** **"Gold Prices Move Daily. Your Decision Doesn't Have To Wait."** · **"Buy verified physical gold from licensed UAE dealers — fully insured, in minutes."** · CTA: **"Lock In Today's Rate"**

**Why it's better** — Adds genuine, real (non-gimmicky) urgency rooted in a true market fact (gold prices do fluctuate daily) rather than fake countdown urgency — this satisfies the brief's "scarcity only when genuine" rule.

**Psychological principles:** genuine scarcity/urgency (price volatility is real and verifiable), loss aversion.

**Conversion impact:** Sticky/persistent bars work best with a reason to act *now* — tying the CTA to real price movement (not a fake timer) should lift click rate without feeling manipulative.

---

### 1.9 Footer (`Footer.jsx`)

**Current link label:** "How it works (FAQ)"
**Improved:** **"How Cridora Works"** (link text should sell the click; keep "FAQ" as a small secondary label or separate link, since "How it works" and "FAQ" serve different search/user intents and merging them under one label buries both).

**Current disclosure:** "© 2026 Cridora. All rights reserved. Dubai, UAE."
**Improved:** keep as-is — factual, appropriately understated for a footer. Add directly above it, once: **"Cridora is a technology marketplace connecting buyers with independent, licensed UAE bullion dealers. Cridora does not hold customer gold or funds as custodian."** This single sentence, stated plainly in the footer (not hidden in T&Cs), is a strong, honest trust signal — full transparency about what Cridora is and isn't builds more trust than omitting it.

---

## 2. Marketplace / Gold Catalog (`Marketplace.jsx`)

### 2.1 Page header

**Current:** H1 "The" / "Marketplace" · eyebrow "UAE partners · KYC · KYB · AML · Stripe" · search placeholder "Search metal, vendor..."

**Improved:**
> Eyebrow: **"Live rates · Verified dealers only"**
> H1: **"Every Gram, Verified."**
> Sub: **"Compare real-time prices from licensed UAE gold and silver dealers. Choose the listing that's right for you — we've already checked the dealer."**
> Search placeholder: **"Search gold, silver, or a dealer name"**

**Why it's better** — "The / Marketplace" is a stylistic two-line H1 that says nothing about value; "Every Gram, Verified" restates the core trust promise at the exact moment a user is about to compare/choose a product — reinforcing confidence right before a decision.

**SEO improvements** — H1/sub now naturally carries "gold and silver dealers," "UAE," "live rates" for "gold bullion Dubai" / "UAE bullion dealers" intent; page `<title>` should read `"Buy Gold & Silver Online in UAE | Live Prices — Cridora"`.

**Psychological principles:** trust-building at the decision point, cognitive fluency (dropped the acronym string entirely).

**Conversion impact:** Reinforcing "verified" right at the listing grid (not just on the homepage) keeps trust top-of-mind exactly where the buy decision happens.

---

### 2.2 Filters & sort

**Current:** "All Metals," "Gold," "Silver," "Platinum" · Sort: "Default," "Wishlist first," "Price: Low → High," "Price: High → Low," "Top Rated" · "{n} listing(s) found"

**Improved:** Keep filter/sort labels — they're already clear, functional, and low-risk to change (avoid over-editing working UI copy). Only change:
> "{n} listing(s) found" → **"{n} live listings"** (drops the clunky "(s)" pluralization and reads more premium)
> "No listings match your search" → **"No listings match yet — try a different metal or dealer."** (see §2.4)

**Why it's better** — Minimal, surgical change per the "don't over-edit working copy" principle; "live listings" subtly reinforces the real-time-pricing trust story used throughout the page.

---

### 2.3 Product card labels (`MetalCard`)

**Current:** "KYB-verified seller" · "Effective rate / g" · "Buyback spread (x) / g" · "Total incl. fees · {g}g" · "New Listing" / "Be the first to buy" · "Shop Closed" / "Buy Now" / "Unavailable"

**Improved:**
> "KYB-verified seller" → **"Verified Dealer"**
> "Effective rate / g" → **"Your price per gram"**
> "Buyback spread (x) / g" → **"Sell-back rate per gram"**
> "Total incl. fees · {g}g" → **"Total for {g}g — nothing added later"**
> "New Listing" / "Be the first to buy" → **"New on Cridora"** / **"Be the first to own this listing"**
> "Buy Now" → **"View & Buy"** (card-level CTA opens the quote — "Buy Now" over-promises a single click purchase)
> "Unavailable" / "Shop Closed" → **"Currently Unavailable"** / **"Dealer Temporarily Closed"**

**Why it's better** — "Total incl. fees" technically answers "is there a hidden cost," but passively; "nothing added later" directly answers the buyer's real fear (surprise charges at checkout) in plain language — this is the single highest-leverage line on the card for reducing checkout hesitation.

**SEO improvements** — n/a (dynamic card data, not typically indexed), but consistent terminology here should match the marketing pages so users don't feel a "bait and switch" between ad copy and product copy (a known trust-killer).

**Psychological principles:** loss aversion / anti-surprise framing, trust-building, honest availability states (no fake scarcity like "only 2 left" unless the number is real inventory — the existing "12 units" style should stay, since that's genuine).

**Conversion impact:** "Nothing added later" is a direct rebuttal to price-checkout abandonment, historically one of the top reasons for cart drop-off in e-commerce; expect a measurable reduction in quote-to-confirm drop-off from this line alone.

---

### 2.4 Empty state

**Current:** "No listings match your search"

**Improved:** **"No listings match yet — try a different metal, or check back soon as dealers restock daily."**

**Why it's better** — Original is a dead end; improved version gives the user two next actions and reframes an empty result as temporary/normal rather than a platform failure.

**Psychological principles:** emotional reassurance, reduces bounce at a zero-result state (a moment users often mistake for "this platform has nothing").

---

## 3. Buy Flow — Quote → Confirm (`BuyModal`)

### 3.1 Quote step

**Current:** "Price Quote" · "Verified Vendor" · "Metal price" · "VAT" ("Included"/"Not applicable") · `Cridora Service Fee (${pct}%)` · "Delivery and packing fees are excluded — added only when you request delivery." · "Total" · "This price is locked for {ttl} seconds..." · CTA "Proceed to Confirm"

**Improved:**
> Step label: **"Step 1 of 2 — Your Price"**
> "Verified Vendor" → **"Sold by a Verified Dealer"**
> "Metal price" → **"Gold value ({g}g)"**
> "Cridora Service Fee (${pct}%)" → **"Cridora Assurance ({pct}%) — verification, secure handling & buy-back guarantee"**
> Delivery note → **"Delivery isn't included yet — you'll choose it later, only if you want it."**
> "Total" → **"Your Total Today"**
> Lock timer → **"Your price is locked for the next {ttl} seconds — plenty of time to confirm."**
> CTA: **"Confirm My Price"**

**Why it's better** — Renaming the line-item from "Cridora Service Fee" to "Cridora Assurance" plus a plain-English *reason* ("verification, secure handling & buy-back guarantee") is the single most important pricing-language change in the app per the brief — it turns the one number most likely to trigger hesitation into a bundle of stated protections. The countdown timer copy is softened from a slightly threatening "locked for X seconds" to a reassuring "plenty of time to confirm" — same fact, opposite emotional register.

**SEO improvements** — n/a (authenticated in-app flow, not indexed).

**Psychological principles:** premium pricing language (core brief requirement), loss aversion (locked price = protection from the market moving against them), emotional reassurance on the countdown.

**Conversion impact:** This is the exact screen where price-sensitivity peaks; reframing the fee line is expected to reduce abandonment between "see quote" and "confirm" more than any other single change in this document.

---

### 3.2 Confirm step

**Current:** "Order Confirmation" · Summary: "Product," "Quantity," "Seller," "Price locked at," "Total (incl. fee)," "Quote ID" · "Guaranteed sell-back at AED …/g … per listing terms." · errors "Failed to place order. Please try again." / "Network error. Please try again." · "Back" / "Place Order"

**Improved:**
> Step label: **"Step 2 of 2 — Confirm & Own It"**
> "Total (incl. fee)" → **"Total (Cridora Assurance included)"**
> Sell-back line → **"You can sell this back to {vendor} anytime at AED {rate}/g — guaranteed."**
> Errors: **"We couldn't place your order — your price is still locked. Please try again."** / **"Connection issue — your price is safe. Check your connection and try again."**
> CTA: **"Confirm & Own This Gold"** (primary) / "Back" (secondary, unchanged)

**Why it's better** — The original error messages are functionally correct but create silent anxiety: did the failed attempt use up the locked price? The improved versions explicitly reassure the user their price/quote is unaffected by the technical failure — a small line that meaningfully reduces panic-driven retries or drop-off after an error.

**Psychological principles:** emotional reassurance under failure states (this is a frequently-missed opportunity — most apps only optimize the happy path), commitment & consistency (final CTA restates ownership language established in the hero).

**Conversion impact:** Error-state copy is rarely optimized but directly affects retry-vs-abandon behavior; reassuring the user their quote/price is intact should increase retry rate after transient failures.

---

### 3.3 Gate modals

**LoginPromptModal — Current:** "Sign In to Continue" · "Sign in to buy this listing. New to Cridora? You can create an account in seconds."
**Improved:** **"Almost There — Sign In to Buy"** · **"One quick sign-in and this listing is yours to confirm. New here? Creating an account takes under a minute."**

**KycRequiredModal — Current:** "Verify Your Identity to Buy" / "Complete KYC"
**Improved:** **"One Last Step: Verify Your Identity"** · CTA: **"Verify Now — Takes 5 Minutes"**
**Supporting line (new):** **"This protects every buyer on Cridora, including you."**

**VendorKycPendingModal — Current:** "KYC pending" / "Verification declined" / "Dealer verification required" / "Browse other vendors"
**Improved:** **"This Dealer Is Still Being Verified"** / **"This Dealer Didn't Pass Verification"** / **"We Only List Verified Dealers"** · CTA: **"See Other Verified Dealers"**

**Why it's better** — Every gate/interruption modal is reframed from a blocking obstacle ("Sign In to Continue," "Complete KYC") into a *proximity-to-goal* statement ("Almost There," "One Last Step") — this is a well-established pattern (checkout progress framing) for keeping users moving through mandatory friction instead of abandoning at it. The KYC modal adds a one-line "why" (protects every buyer) because unexplained verification steps are a common source of drop-off; stating the reason converts a demand into a shared safety measure.

**Psychological principles:** commitment & consistency (proximity-to-goal language), reciprocity/fairness (explaining *why* KYC exists rather than just demanding it), trust-building (the vendor-KYC-pending copy turns "we blocked this dealer" into "we only list verified dealers" — same fact, framed as a promise instead of a restriction).

**Conversion impact:** Gate/interstitial screens are classic abandonment points; proximity framing plus a stated reason for the step typically improves KYC-start rate and reduces "why do I need this" support tickets.

---

## 4. Checkout / Payment (`Payment.jsx`)

### 4.1 "What's Included" (was "Fee breakdown")

**Current:** "Fee breakdown" · "Hide"/"Show" · "Metal / gold value" · "Cridora Service Fee" · "PSP fee (estimate)" · "Service fees are non-refundable. Sell-back uses a separate convenience fee..."

**Improved:**
> Section title: **"What's Included in Your Total"**
> "Metal / gold value" → **"Gold value"**
> "Cridora Service Fee" → **"Cridora Assurance"**
> "PSP fee (estimate)" → **"Secure Payment Handling (est.)"**
> Disclosure: **"Cridora Assurance covers verification, secure handling, and your buy-back guarantee. It isn't refundable once your order is placed — selling back uses a separate, clearly shown rate."**

**Why it's better** — "Fee breakdown" invites scrutiny/suspicion by naming the section after the thing users are afraid of; "What's Included" answers the same transparency need while framing it as value disclosure, not cost disclosure. This is a direct application of the brief's pricing-language rule at the exact moment (payment screen) where it matters most.

**Psychological principles:** premium pricing language, transparency-as-trust (still shows every line item — nothing is hidden, only reframed), reciprocity (explaining what the charge buys, not just what it costs).

**Conversion impact:** Payment-screen fee anxiety is the single largest driver of last-step checkout abandonment industry-wide; reframing this section is expected to have an outsized effect on final conversion relative to its small copy footprint.

---

### 4.2 Order summary

**Current:** "Order Summary" — Product, Vendor, Quantity, Rate/gram, Cridora Service Fee, "Total"

**Improved:** **"Your Order"** — Product, Dealer, Quantity, Rate per gram, **Cridora Assurance**, **"Total — Ready to Pay"**

**Why it's better** — "Order Summary" is neutral/administrative; "Your Order" is warmer and more personal, consistent with the ownership framing used site-wide.

---

### 4.3 Status banners & errors

**Current:** "Could not start payment." · "Could not start card checkout. Try again or contact support." · "Payment confirmation failed." · "Unable to load order" · "Payment window closed" · "Awaiting vendor approval" · "Vendor accepted your order!" · "Order rejected by vendor" · "Order expired"

**Improved:**
> "Could not start payment." → **"We couldn't start your payment. Your order is safe — please try again."**
> "Could not start card checkout. Try again or contact support." → **"Card payment didn't go through. No charge was made — try again, or contact us and we'll help."**
> "Payment confirmation failed." → **"We're double-checking your payment. If you were charged, your order will confirm automatically — no action needed."**
> "Unable to load order" → **"We couldn't load this order. It hasn't been affected — please refresh."**
> "Payment window closed" → **"Your Price Window Has Closed"** with body **"Prices move with the market — here's today's live rate to buy again."**
> "Awaiting vendor approval" → **"Your Order Is With the Dealer"** — "They typically confirm within [X]. We'll notify you the moment they do."
> "Vendor accepted your order!" → **"Great News — Your Dealer Confirmed!"**
> "Order rejected by vendor" → **"This Dealer Couldn't Fulfil Your Order"** — "No charge was made. Here are other verified dealers with this listing."
> "Order expired" → **"This Order Has Expired"** — "No charge was made. Get today's live rate and try again."

**Why it's better** — Every single error/status message in the original is written from the *system's* point of view (what failed) rather than the *user's* point of view (am I safe, was I charged, what happens next). The rewritten versions consistently answer the two questions every payment-failure user silently asks: "Was I charged?" and "What do I do now?" — this is the highest-value fix in the entire checkout flow.

**Psychological principles:** emotional reassurance (explicitly answering "was I charged"), loss aversion neutralization (removing ambiguity prevents users from assuming the worst and abandoning), trust-building under failure (a platform that's calm and clear when something goes wrong earns more long-term trust than one that's only polished on the happy path).

**Conversion impact:** Payment-failure copy directly determines retry vs. permanent abandonment; explicitly stating "no charge was made" or "your order is safe" at every failure point should materially increase retry rates and reduce support contact volume.

---

### 4.4 Success state

**Current:** "Payment Confirmed" / "Your metal is held securely. Redirecting to your portfolio…"

**Improved:** **"You Now Own Real Gold."** / **"Your purchase is complete and held securely at {vendor}. Taking you to your portfolio…"**

**Why it's better** — The single most emotionally important moment in the entire app (the moment of ownership) was given the same flat tone as a form-submission confirmation. This is the peak moment to deliver on the brief's core emotional goal ("I don't want to buy gold anywhere else") — it deserves a genuinely celebratory, ownership-affirming line, not a passive-voice status update.

**Psychological principles:** peak-end rule (the emotional peak of a flow disproportionately shapes overall satisfaction and recall — this is the peak), premium positioning, emotional reassurance.

**Conversion impact:** This screen most directly drives repeat-purchase intent and word-of-mouth; a stronger emotional payoff here should improve retention and referral behavior more than almost any other single screen.

---

### 4.5 Pay button & method help text

**Current:** "Pay — AED {total}" · method help text (Stripe/Telr/Aani descriptions)

**Improved:** **"Pay AED {total} — Securely"** (keep amount visible and primary — never hide total price behind vague CTAs like "Continue"). Method help text: keep factual and short, but ensure every method's line ends with a trust cue, e.g. **"Aani — instant bank transfer, verified by your bank."**

---

## 5. Sign In / Sign Up (`SignIn.jsx`, `SignUp.jsx`)

### 5.1 Sign In

**Current:** "Welcome Back" / "Sign in to access your dashboard" · "Invalid email or password."

**Improved:** **"Welcome Back"** (keep — it's genuinely good, warm and premium) / **"Sign in to manage your gold investments"** (replaces generic "dashboard" with the actual value: their investments) · Error: **"That email or password doesn't match our records. Please try again."** (slightly warmer than "Invalid," and doesn't imply the user did something wrong)

### 5.2 Sign Up

**Current step labels:** "Account" · "Personal" · "Verify"
**Improved:** **"Account"** · **"About You"** · **"Review"** (renaming "Verify" → "Review" removes false expectation of an OTP/SMS step, since this step is actually a details-review screen, not identity verification — accuracy matters for trust)

**Current H1/sub:** "Create Account" / "UAE partners · Full KYC · KYB vendors · AML-aware · Stripe when enabled"
**Improved:** **"Start Your Gold Investment Journey"** / **"Takes about 2 minutes. Verified dealers, secure payments, real gold."**

**Current validation:** "Email is required" · "Enter a valid email" · "Password is required" · "At least 8 characters" · "Passwords do not match" · "First name is required" · "Last name is required" · "Please select your country" · "You must agree to the terms"

**Improved:**
> "Email is required" → **"Enter your email to continue"**
> "Enter a valid email" → **"That doesn't look like a valid email — check for typos"**
> "At least 8 characters" → **"Use at least 8 characters"**
> "Passwords do not match" → **"Your passwords don't match yet"**
> "Please select your country" → **"Select your country so we can show the right dealers"**
> "You must agree to the terms" → **"Please review and accept our terms to continue"**

**Why it's better** — Original validation is standard but slightly accusatory ("X is required," "You must"); rewritten versions use instructional, next-step phrasing ("Enter your email to continue") which reads as guidance rather than a rejection. The country-selection message goes further and states *why* it's needed (shows the right dealers) — unexplained required fields are a common source of form abandonment.

**Registration failure:** "Registration failed. Please try again." → **"We couldn't create your account just now. Nothing was saved — please try again."**

**Review step (was "Verify"):** "Review Your Details" (keep) / "KYC Verification Next" → **"One More Step: Verify Your Identity"** with supporting line **"This is what keeps every buyer and dealer on Cridora safe — it takes about 5–10 minutes."**

**Psychological principles applied throughout:** reduced perceived friction via instructional (not accusatory) validation copy, transparency about what's coming next (removes the false OTP expectation), reciprocity (explaining why each step exists).

**SEO improvements:** n/a (authenticated flow).

**Conversion impact:** Sign-up form abandonment is disproportionately driven by validation-message tone and unexplained required steps; these changes target both without adding any new fields or friction.

---

## 6. Order History & Empty States

**Current:** "Orders & History" / "All your buy and sell orders" · CTA "Want to buy more metals? Browse the Marketplace →" · **no dedicated empty state** when `filteredOrders` is empty · Portfolio empty: "No holdings" / "No holdings for {metal}"

**Improved:**
> Header: **"Your Orders"** / **"Every purchase and sale, in one place"**
> **New empty state (currently missing):** **"You haven't made a purchase yet."** / **"Your first gold purchase will appear here, ready to track from the moment you confirm it."** · CTA: **"See Today's Rates"**
> Portfolio empty → **"You don't own any {metal} yet"** / **"Start with any amount — even a single gram is real, verified ownership."** · CTA: **"Browse {metal} Listings"**
> Existing CTA "Want to buy more metals? Browse the Marketplace →" → **"Ready to grow your holdings?"** / **"Browse the Marketplace →"**

**Why it's better** — The current build has **no empty state at all** for a first-time user with zero orders — this is a real gap, not just a wording issue, and should be flagged to engineering as a missing screen, not only a copy fix. An empty order history is a first-time user's very first impression of "what does owning gold on Cridora feel like" — leaving it blank wastes a trust-building opportunity. The rewritten portfolio empty state ("even a single gram is real, verified ownership") directly counters the common belief that gold investing requires large capital — this is a genuine accessibility/objection-handling insight worth stating explicitly.

**Psychological principles:** emotional reassurance for new users, accessibility framing (removes the "gold investing is only for the wealthy" objection), commitment & consistency (turns an empty screen into a nudge toward the first purchase).

**Conversion impact:** A well-designed empty state for first-time users is a proven activation lever; "even a single gram" reframing should specifically help convert price-anxious first-time visitors who assume a high minimum buy-in.

---

## 7. FAQ (`HowItWorks.jsx`)

Keep every answer factually identical (these are compliance-sensitive statements) — only tighten tone, lead with the reassuring fact first, and use consistent terminology (drop "MVP," keep "Cridora Assurance" naming consistent if referenced).

| Current question | Improved question | Improved answer opening |
|---|---|---|
| "Is Cridora a bank or financial institution?" | **"Is Cridora a bank?"** | **"No — and that's by design. Cridora is a technology marketplace that connects you directly to licensed UAE bullion dealers…"** |
| "Where is my metal physically stored?" | **"Where is my gold actually kept?"** | **"Your gold is held securely by the dealer you bought it from, under their vault and insurance arrangements…"** |
| "What happens if a vendor goes out of business?" | **"What if a dealer can't fulfil my order?"** | **"Every dealer agrees to maintain enough verified inventory to cover customer holdings…"** |
| "Can I take physical delivery of my metal?" | **"Can I have my gold delivered to me?"** | *(state current real limitation honestly, then the roadmap if applicable — do not overpromise)* |
| "How long does the KYC process take?" | **"How long does identity verification take?"** | **"Most customers are verified in 5–10 minutes."** |

**Why it's better** — Questions rewritten in first person ("my gold," "can I") mirror how a real user actually searches/asks, which both reads more naturally and matches long-tail voice-search phrasing. Leading every answer with the reassuring fact first (before caveats) follows the same peak-first framing used elsewhere in this document.

**SEO improvements** — FAQ content is prime schema-markup territory: wrap this section in `FAQPage` JSON-LD (question/answer pairs) so Google can surface these directly as rich results for "is Cridora safe," "where is my gold stored UAE," "how long does gold KYC take" — high-intent, trust-related queries exactly matching the target keyword list. Also worth a dedicated indexable `/faq` or keeping `/how-it-works` but ensuring each question has a stable anchor (`#is-cridora-a-bank`) for direct linking from search snippets.

**Psychological principles:** trust-building via radical transparency (answering the "is this too good to be true" objection directly and factually, including honest limitations), reduces need for support contact.

**Conversion impact:** FAQ is typically the last stop before a hesitant user either commits or leaves; honest, well-organized answers to the exact "why should I trust this" questions from the brief should reduce pre-purchase support tickets and recover otherwise-lost conversions.

---

## 8. Fee & Pricing Language — Master Glossary

Apply this mapping everywhere a monetary line item is shown to a customer (marketing pages, quote, checkout, invoices, dashboards):

| Old term | New term | Use when |
|---|---|---|
| Cridora Service Fee | **Cridora Assurance** | The core % charge covering verification, secure handling, buy-back guarantee |
| PSP fee / processing fee | **Secure Payment Handling** | Card/bank payment processing pass-through |
| Delivery fee / packing fee | **White-Glove Delivery Service** | Physical delivery/packing cost |
| Fee breakdown | **What's Included** | Section heading before any itemized pricing |
| Convenience fee (sell-back) | **Sell-Back Service** | Cost associated with the buy-back/liquidation flow |
| Storage (unchanged) | **Vault Storage Service** | Ongoing custody cost, if/when applicable |
| Insurance (unchanged) | **Insurance** | Genuinely positive word already — no change needed |

**Legal/finance note:** retain a small-print, once-per-invoice mapping (e.g., "Cridora Assurance (Service Fee)") on the actual tax invoice/receipt PDF to satisfy UAE VAT invoicing clarity requirements — apply the premium terms everywhere the copy is persuasive, keep one precise reference where the copy is a legal record.

---

## 9. Summary — How This Maps to the Brief's Conversion Questions

| Question every page must answer | Where it's now answered explicitly |
|---|---|
| Why should I trust Cridora? | Hero badges (§1.2), Compliance section (§1.6), footer disclosure (§1.9) |
| Why buy here instead of elsewhere? | "Why Cridora" cards (§1.4), guaranteed sell-back messaging (§1.4, §3.2) |
| Is my money safe? | Payment status/error copy (§4.3), "Your funds are protected" (§1.6) |
| Is my gold authentic? | "Verified Dealer" card label (§2.3), FAQ storage answer (§7) |
| Is the process simple? | "The Process" 4-step section (§1.5), gate-modal proximity framing (§3.3) |
| What value does Cridora provide? | Cridora Assurance reframing throughout §3.1, §4.1, §8 |

**Recommended next step:** hand §1–§7 to engineering as literal string replacements (file:line references match the exploration source), keep §8 as the enforced glossary for all future copy, and treat the §6 missing empty-state as a small dev ticket, not just a copy edit.
