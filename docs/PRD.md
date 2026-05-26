# Product Requirements Document

# **Raffle Royale — Product Requirements Document (PRD)**

*A peer‑to‑peer raffling marketplace*

## **1\. Product Summary**

**Raffle Royale** is a peer‑to‑peer raffling platform where users can list items they own and sell limited‑quantity tickets for a chance to win them. Once all tickets are sold—or the raffle reaches its maximum duration—the system determines whether the raffle proceeds or is disbanded.

**Core value:**  

It lets sellers earn more than a typical resale price *and* gives buyers a low‑cost chance to win high‑value items.

## **2\. Goals & Success Metrics**

### **Primary Goals**

* Enable users to easily create and manage raffles.  
* Provide a transparent, fair, and verifiable drawing system.  
* Build trust through identity verification, escrow, and anti‑fraud mechanisms.  
* Create a marketplace where raffles reliably fill.

### **Success Metrics**

* % of raffles that reach full ticket sales.  
* Average time to sell out.  
* Monthly active rafflers (sellers) and participants (buyers).  
* Dispute rate per 1,000 raffles.  
* Revenue per raffle (platform fee).

## **3\. User Roles**

* **Raffler (Seller)** — lists an item, sets ticket count, price, and duration.  
* **Participant (Buyer)** — purchases tickets for raffles.  
* **Admin** — handles disputes, fraud detection, and platform moderation.

## **4\. Core Features**

Below is a breakdown of the major features, each starting with a Guided Link so you can dive deeper into any section.

### **• User Registration & Identity Verification**

* Email, phone, and optional social login.  
* KYC verification for rafflers (ID upload, selfie match).  
* Fraud‑prevention signals (device fingerprinting, velocity checks).

### **• Raffle Creation Flow**

Raffler provides:

* Item title, description, and photos.  
* Number of tickets (min/max).  
* Price per ticket.  
* Maximum duration (e.g., 24–72 hours).  
* Shipping or pickup details.  
* Optional reserve price (if desired in future versions).

System validates:

* Ticket price × ticket count ≥ minimum value threshold.  
* Duration ≤ platform max.  
* Item category allowed.

### **• Ticket Purchasing**

* Users can buy 1–N tickets.  
* Payment methods: card, Apple/Google Pay, wallet balance.  
* Funds held in escrow until the raffle resolves.  
* Real‑time ticket availability updates.

### **• Raffle Resolution Logic**

Two possible outcomes:

#### **1\. All tickets sold before max duration**

→ Raffle triggers immediately.  
→ Winner selected via verifiable randomization (e.g., blockchain seed, public RNG).  
→ Funds released to raffler minus platform fee.

→ Winner notified; raffler ships item.

#### **2\. Max duration reached without sellout**

→ Raffle disbanded.  
→ All participants refunded automatically.  
→ Raffler may relist item.

### **• Winner Selection & Fairness**

* Publicly auditable random seed.  
* Transparent odds per ticket.  
* Winner announcement page with ticket breakdown.  
* Anti‑collusion and multi‑account detection.

### **• Messaging & Notifications**

* Raffle status updates.  
* Ticket purchase confirmations.  
* Winner notifications.  
* Shipping updates.  
* Dispute alerts.

### **• Escrow & Payouts**

* Funds held until raffle resolves.  
* Automatic payout to raffler after winner confirms shipment.  
* Optional dispute window.

### **• Ratings & Reputation**

* Rafflers rated on shipping speed, accuracy and communication.  
* Participants rated on payment reliability.  
* Public profiles with badges (e.g., “Trusted Raffler”).

### **• Admin Tools**

* Fraud detection dashboard.  
* Raffle audit logs.  
* Dispute resolution workflow.  
* Manual refund and freeze controls.

## **5\. Non‑Functional Requirements**

### **Performance**

* Raffle pages must update ticket availability in \<200ms.  
* Winner selection must occur within 5 seconds of sellout.

### **Security**

* Encrypted payment data.  
* Secure escrow.  
* Anti‑bot ticket purchasing.  
* Identity verification for rafflers.

### **Scalability**

* Support thousands of concurrent raffles.  
* Real‑time updates for ticket counts.

### **Legal & Compliance**

* Must comply with raffle/gambling laws per region.  
* Age restrictions (18+ or region‑specific).  
* Clear terms of service and liability disclaimers.

## **8\. Additional Platform Features & Policies**

### **• Minimum Sell‑Through Threshold**

**Purpose:** Give rafflers more control and reduce the risk of low‑engagement raffles.

**Description:**  

Rafflers may optionally set a *minimum sell‑through percentage* (e.g., 60%, 75%, 90%). If the raffle reaches its maximum duration without hitting this threshold, it is automatically disbanded and all participants are refunded.

**Key Requirements:**

* Threshold must be between platform‑defined min/max (e.g., 50–95%).  
* Threshold cannot exceed 100% of tickets.  
* UI must clearly show participants the threshold before purchase.  
* Raffles that fail to meet the threshold are marked as “Unsuccessful” in history.

**Why it matters:**  

This protects rafflers from losing money on high‑value items while maintaining transparency for participants.

### **• Digital Goods Support**

**Purpose:** Expand the marketplace beyond physical items and increase liquidity.

**Description:**  

Allow rafflers to list digital goods such as:

* Game codes  
* Gift cards  
* Software licenses  
* NFTs (optional, depending on compliance)  
* Digital art files  
* Event tickets (transferable)

**Key Requirements:**

* Additional verification for digital goods to prevent fraud.  
* Delivery method must be clearly defined (e.g., email, code reveal, transfer).  
* Escrow logic must support digital delivery confirmation.  
* Some categories may require platform approval.

**Why it matters:**  

Digital goods have zero shipping friction and can dramatically increase raffle volume.

### **• Sponsored & Promoted Raffles**

**Purpose:** Provide monetization opportunities and help rafflers gain visibility.

**Description:**  

Rafflers can pay to promote their raffles in:

* Featured carousel  
* Category‑top placement  
* Search priority  
* “Boosted” badge

**Key Requirements:**

* Transparent labeling of sponsored content.  
* Pricing model (flat fee, CPM, or dynamic bidding).  
* Limits to prevent over‑saturation.  
* Analytics dashboard for rafflers (views, clicks, conversion rate).

**Why it matters:**  

This creates a revenue stream for the platform and helps rafflers with high‑value items reach more buyers.

### **• Private Raffles**

**Purpose:** Enable raffles restricted to a specific audience.

**Description:**  

Rafflers can choose between:

* **Public raffles** (default)  
* **Private raffles** accessible only via invite link  
* **Friends‑only raffles** (if social graph is implemented)

**Key Requirements:**

* Private raffles must not appear in public search or discovery.  
* Invite links must be secure and non‑guessable.  
* Participants must still meet platform KYC and age requirements.  
* Private raffles still follow all escrow and fairness rules.

**Why it matters:**  

Useful for friend groups, clubs, communities, or creators who want to raffle items to their own audience.

## **9\. Updated PRD Structure With These Features Integrated**

Here’s how these additions fit into the existing PRD:

### **Core Features (Section 4\)**

Add subsections under Raffle Creation Flow:

* Minimum Sell‑Through Threshold  
* Public vs Private Raffle Setting  
* Digital Goods Category Support

### **Monetization (New Section)**

Add Sponsored & Promoted Raffles as a revenue channel.

### **Compliance (Section 5\)**

Add digital goods verification and private raffle access rules.
