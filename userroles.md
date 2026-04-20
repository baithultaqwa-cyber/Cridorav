Cridora — User Groups, Roles & Dashboards

Cridora operates with 3 primary user groups:

Customers (Buyers)
Bullion Vendors (Sellers)
Cridora Admin (Platform Operator)

Each group has distinct responsibilities, permissions, and dashboards.

🧑‍💼 1. Customers (Retail Buyers)
Who they are
Global users (India, Pakistan, EU, US, etc.)
Want to invest in gold/silver/platinum digitally
Prefer easy buy + guaranteed sell-back
Core Capabilities
KYC onboarding
Browse marketplace
Get real-time quotes
Buy metals
View holdings (portfolio)
Sell back to vendor
Track orders & transactions
Customer Dashboard (UX structure)
Top Summary Cards
🟡 Total Gold (grams)
⚪ Total Silver
🔵 Other metals
💰 Total invested (AED / user currency)
📈 Current portfolio value
📊 Unrealized P&L
Main Sections
1. Marketplace
Product listing (by vendor)
Filters:
Metal type (Au, Ag, Pt)
Weight
Vendor
Product card shows:
Price
Buyback rate
Vendor name (verified badge)
2. Portfolio (Core screen)
Holdings grouped by:
Vendor
Product
Ledger table:
Date
Product
Quantity
Buy price
Current value
Sell option
3. Buy Flow
Quote screen:
Locked price (TTL countdown)
Order confirmation
Payment (Stripe)
4. Sell-back Flow
Select lots (FIFO default)
Show:
Vendor buyback price
Fees
Net payout
Submit request
5. Orders & History
Buy orders
Sell orders
Status tracking
6. Account
KYC status
Bank details
Settings
Customer Value Perception

👉 “I can buy gold easily and exit anytime safely.”

🏢 2. Bullion Vendors
Who they are
UAE-based gold dealers / bullion traders
Want:
More customers globally
Digital sales channel
Inventory monetization
Roles inside Vendor
Owner
Full control
KYB, banking, team management
Sales Staff
Operate live desk
Manage catalog/prices
Core Capabilities
List products (gold/silver/platinum)
Set buy & buyback prices
Accept/reject orders in real time
Manage inventory
Handle sell-back requests
View financial statements
Manage team
Vendor Dashboard (UX structure)
Top Summary Cards
💰 Today’s sales
📦 Active inventory
🔄 Sell-back requests
👥 Active customers
Main Sections
1. Live Sales Desk (MOST IMPORTANT)
Incoming buy requests (with timer ~60s)
Actions:
Accept
Reject
Shows:
Product
Quantity
Price

👉 This is their trading console

2. Sell-back Queue
Customer sell requests
Shows:
Quantity
Payout required
Action:
Approve (if balance OK)
Reject
3. Catalog Management
Add/edit products:
Metal type
Weight
Purity
Price
Buyback rate
Toggle visibility
Stock management
4. Inventory
Available stock
Reserved stock
5. Financials (Critical)
Vendor pool balance
Pending debits (sell-back)
Credits (sales)
Available balance
6. Statements
Daily EOD reports
Transaction breakdown
7. Team Management
Add/remove staff
Assign roles
Reset passwords
8. Insights (Optional early)
Sales trends
Customer count
Volume
Vendor Value Perception

👉 “I get global customers without handling tech or payments.”

🛡️ 3. Cridora Admin (Platform Control)
Who they are
Internal operations team
Compliance, finance, risk, support
Core Responsibilities
KYC/KYB approvals
Monitor transactions
Manage disputes
Configure fees
Ensure financial integrity
System oversight
Admin Roles
Super Admin → full control
Delegated Admin → restricted access
Admin Dashboard (UX structure)
Top Overview
📊 Total transactions
👤 Active users
🏢 Active vendors
⚠️ Alerts (risk, failures)
Main Sections
1. User Management
View users
KYC queue
Freeze accounts
2. Vendor Management
KYB approval
Vendor status
Freeze vendor
3. Orders & Transactions
All orders
Status tracking
Debug issues
4. Settlement & Finance
Vendor pools
Daily reconciliation
Payment logs
Crypto (if enabled later)
5. Fees & Configuration
Buy/sell fees
Vendor tiers
Feature flags
6. Risk & Disputes
Flagged transactions
Dispute resolution
Freeze actions
7. Audit & Logs
Admin actions
System events
8. Live Monitoring (Advanced)
Active sessions
System activity
Admin Value Perception

👉 “I can control, audit, and ensure the system is safe and compliant.”

🧩 System Interaction Summary
Action	Customer	Vendor	Admin
Buy metal	Initiates	Accepts	Observes
Sell metal	Requests	Approves + pays	Oversees
Pricing	Views	Sets	Configures rules
Risk	Affected	Affected	Controls
Funds	Receives	Holds	Audits


🧑‍💼 Cridora Customer Portfolio — Detailed Design
🧭 Overall Layout Structure
--------------------------------------------------
| Summary Cards (Top)                            |
--------------------------------------------------
| Portfolio Value Graph (Optional early)         |
--------------------------------------------------
| Holdings by Vendor (Grouped View)              |
--------------------------------------------------
| Ledger Table (Detailed Transactions)           |
--------------------------------------------------
🟡 1. Summary Cards (Top Section)

These are high-trust indicators.

Display:
Total Portfolio Value
“Current sell-back value”
Total Invested
Unrealized Profit / Loss
Total Gold (g)
Total Silver (g)
Other Metals (g)
Example:
Total Value:        AED 52,300
Total Invested:     AED 48,000
Unrealized P&L:     + AED 4,300 (+8.9%)

Gold: 120.5 g   |   Silver: 800 g
Important Rule:

👉 Portfolio value must be based on:
vendor buyback price (NOT market spot)

This avoids:

Fake profits
Misleading UI
📊 2. Portfolio Value Graph (Optional MVP+)
Shows:
Value over time (based on buyback rates)
Keep simple initially:
7D / 30D / All time toggle

👉 You can skip this in MVP if needed.

🏢 3. Holdings (Grouped by Vendor)

This is where your product becomes unique.

Vendor Group Card
-----------------------------------------
Vendor: Bhima Jewellers ✅

Total Value: AED 32,000
Total Quantity: 75g

[View Details]   [Sell]
-----------------------------------------
Inside Vendor Group

Each product/lot grouped:

Gold Bar 24K (10g)
-----------------------------------------
Total Held: 50g
Avg Buy Price: AED 245/g
Current Buyback: AED 260/g

Value: AED 13,000
P&L: + AED 750

[Sell]
-----------------------------------------
Why grouping matters:
Sell-back is vendor-specific
Users understand:
👉 “I must sell back to THIS vendor”
📋 4. Ledger Table (Critical for trust)

This is your audit + transparency layer.

Columns
Date	Type	Product	Vendor	Qty	Buy Price	Current Value	Status
Example Rows:
12 Apr | BUY  | Gold 10g | Bhima | 10g | 250/g | 2600 | Completed
14 Apr | BUY  | Gold 20g | Malabar | 20g | 248/g | 5200 | Completed
18 Apr | SELL | Gold 5g  | Bhima | -5g | — | 1300 | Completed
Key Features:
Sortable
Filter by:
Vendor
Metal
Date
Important:

👉 This must feel like a bank statement, not a shopping history.

🧮 5. Lot-Level Detail (Expandable Row)

When user clicks a row:

Lot ID: L-10234
Vendor: Bhima
Original Qty: 10g
Remaining Qty: 7g

Buy Price: AED 250/g
Buy Date: 12 Apr

Quote ID: Q-88921

👉 This is critical for:

Disputes
Transparency
Advanced users
💸 6. Sell Action (Integrated in Portfolio)

Each holding should have:

👉 Direct “Sell” button

Sell Preview Modal:
You are selling: 10g Gold (Bhima)

Buyback Price: AED 260/g
Gross Value: AED 2600

Fee: AED 15
Net Payout: AED 2585

[Confirm Sell]
Important UX rule:

👉 Always show NET payout clearly

⚖️ 7. Profit/Loss Calculation
Show both:
Unrealized:
Based on current buyback price
Realized:
From completed sell orders
Example:
Unrealized P&L: + AED 4,300
Realized P&L:   + AED 1,200
🔍 8. Filters & Controls
Filter by:
Metal (Gold/Silver/Platinum)
Vendor
Toggle:
Grouped view
Flat ledger view
⚠️ 9. Trust Indicators (VERY IMPORTANT)

Add small but powerful UI elements:

✅ “Backed by vendor inventory”
🔒 “Sell-back guaranteed by vendor”
⏱ “Payout after vendor confirmation”

These reduce:
👉 Fear of scam
👉 Fear of illiquidity

🚨 Common Mistakes to Avoid

❌ Showing global gold price instead of buyback
❌ Hiding fees until last step
❌ Mixing vendors in one balance
❌ No clear sell option
❌ Confusing P&L calculations

🎯 Final UX Philosophy

Your portfolio should answer 3 questions instantly:

How much do I have?
How much is it worth right now?
How fast can I sell it?
💬 Pitch-ready line

“Cridora’s portfolio is designed like a financial ledger—giving users complete visibility into their holdings, real-time sell-back value, and instant liquidity with a single action.”


Cridora — User Access & Admin System (Refined)
🔐 Authentication System
Single login system for all user types:
Cridora Admin
Bullion Vendors
Customers
All users log in through the same login page
Based on role, users are redirected to their respective dashboards
👥 User Types Overview
User Type	Access
Customer	Buy, hold, sell metals
Bullion Vendor	Manage products, accept/reject orders, handle sell-back
Cridora Admin	Platform control, compliance, monitoring
🛡️ Cridora Admin Dashboard (Detailed Structure)
🏠 1. Dashboard (Overview)

Displays key platform metrics:

Total users
Active users
Pending users (KYC not approved)
Total vendors
Pending vendor approvals (KYB)
Total buy volume
Total sell-back volume
Total platform revenue
Alerts (pending approvals, failed transactions, etc.)
👤 2. Users Management

Admin can:

View all users
Search / filter users
See KYC status:
Verified
Pending
Rejected
Actions:
Activate / deactivate user
View uploaded documents
Approve / reject KYC
Ledger Access:
“View Ledger” button shows:
Same portfolio ledger as seen by the user
All buy/sell transactions
Holdings
🏢 3. Vendors Management

Admin can:

View all vendors
Sort / filter vendors
Review KYB documents
Approve / reject vendors
Additional capabilities:
View vendor product listings
Monitor pricing and buyback configuration
Activate / deactivate vendor
📊 4. Transactions

Central transaction monitoring system.

Admin can:

View all transactions:
Buy orders
Sell-back orders
Status filters:
Pending
Ongoing
Completed
Failed
Advanced filters:
By vendor
By metal (Gold / Silver / Platinum)
By user
By date
💰 5. Financial Overview (Optional MVP+)
Total inflow (user payments)
Vendor payouts
Platform fees
Reconciliation status
🔄 Re-Verification Rule (Critical Trust Feature)
Trigger Conditions:

If a user or vendor updates:

KYC/KYB documents
Bank account details
Email (optional but recommended)
System Behavior:
Account is marked as:
“Re-verification required”
System actions:
Disable trading (buy/sell blocked)
Keep login access (optional)
Flag in admin panel
Admin must:
Review updated data
Approve or reject
Once approved:
Account becomes active again

👉 This ensures:

Compliance
Fraud prevention
Trust with vendors and users
🔁 Simplified Workflows
🟢 Buy Flow (Simplified)
Customer selects product
System generates price quote (with expiry)
Customer places order
Vendor gets real-time request (≈60 sec window)
If rejected / timeout → order cancelled
If accepted → proceed
Customer completes payment
Payment confirmed (via backend verification)
System:
Creates lot (holding)
Updates portfolio
Updates vendor pool
🔴 Sell-back Flow (Simplified)
Customer selects holding (portfolio)
System shows:
Vendor buyback price
Fees
Net payout
Customer submits sell request
Vendor reviews request
If insufficient balance → reject
If approved → proceed
System initiates vendor debit
If debit fails → cancel
If debit clears → proceed
User receives payout
Holdings updated
🎯 System Design Principle
Single entry point (login)
Role-based access control
Admin-driven verification
Vendor-controlled pricing & liquidity
User-focused transparency & exit (sell-back)