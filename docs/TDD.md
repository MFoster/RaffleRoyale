
# High Level Tech Design

## **MVP Architecture Strategy — Build Simple, Grow Smart**

### **1\. Core Principle: Start with a Web App**

A web app gives you:

* Fast iteration  
* Easy deployment  
* No app‑store gatekeeping  
* Lower cost  
* Immediate cross‑platform reach

The MVP should prioritize **correctness, clarity, and trust**, not speed.

## **2\. MVP Architecture Overview**

Below is a clean, scalable architecture that starts simple but evolves well.

### **Frontend**

* React / Next.js  
* Tailwind or Material UI  
* WebSockets or SSE for real‑time ticket updates (optional for MVP)

### **Backend**

* Node.js (Express, Fastify, or NestJS)  
* REST API first; GraphQL optional later  
* Background job processor (BullMQ, Cloud Tasks, or simple cron for MVP)

### **Database**

* PostgreSQL (ideal for transactional consistency)  
* Redis (optional for caching later)

### **Hosting**

* Vercel/Netlify for frontend  
* Render/Fly.io/AWS for backend  
* Cloudflare for CDN and DDoS protection

### **Payments**

* Stripe for ticket purchases \+ escrow logic  
* Stripe Connect for raffler payouts

## **3\. MVP Feature Priorities**

These are the engineering priorities for the first build.

### **• Raffle Creation**

Simple form → store in DB → background job schedules expiration.

### **• Ticket Purchasing**

For MVP:

* Accept purchases sequentially  
* Lock row during purchase to avoid overselling  
* No need for ultra‑high concurrency yet

### **• Raffle Resolution**

Two cron‑friendly tasks:

* Check for sellout → trigger winner selection  
* Check for expiration → disband raffle

### **• Winner Selection**

Use a secure RNG (crypto.randomUUID or crypto.randomInt).

Blockchain‑based randomness can come later.

## **4\. MVP Data Model (High‑Level)**

### **Tables**

* **Users**  
* **Raffles**  
* **Tickets**  
* **Transactions**  
* **Payouts**  
* **RaffleEvents** (audit log)

### **Key MVP Constraints**

* Ticket count must be atomic  
* Raffle status transitions must be deterministic  
* All money must be traceable

## **5\. Handling Concurrency — MVP vs. Future**

### **MVP Approach (Simple & Safe)**

* Use **Postgres row‑level locking** (`SELECT … FOR UPDATE`)  
* Process ticket purchases sequentially  
* Accept slightly slower purchase times  
* No need for distributed locks or queues yet

This is totally fine for early usage.

### **Future High‑Volume Approach**

When Raffle Royale grows, you’ll need:

#### **• Distributed Locking**

Redis Redlock or Postgres advisory locks.

#### **• Event‑Driven Architecture**

Kafka, NATS, or SNS/SQS for:

* Ticket purchase events  
* Raffle state transitions  
* Winner selection triggers

#### **• Optimistic Concurrency**

Versioning rows to prevent race conditions.

#### **• In‑Memory Caching**

Store ticket availability in Redis for ultra‑fast reads.

#### **• Horizontal Scaling**

Multiple backend instances behind a load balancer.

## **6\. Raffle Expiration & Sellout Logic**

This is the heart of the system.

### **MVP Logic**

* Cron job runs every minute  
* Checks raffles where:  
  * `end_time <= now()`  
  * OR `tickets_sold == total_tickets`

### **Future Logic**

* Event‑driven triggers  
* Real‑time updates  
* Millisecond‑accurate sellout detection

## **7\. Security & Fraud Prevention**

Even in MVP, you need:

### **• Basic KYC**

At least for rafflers.

### **• Escrow Logic**

Stripe handles most of this.

### **• Audit Logging**

Every raffle event should be logged.

## **8\. MVP Deployment Strategy**

### **Phase 1 — Internal Alpha**

* No real payments  
* Fake raffles  
* Manual winner selection

### **Phase 2 — Closed Beta**

* Stripe sandbox  
* Real raffles with friends  
* Monitor performance

### **Phase 3 — Public MVP**

* Real payments  
* Real raffles  
* Basic support tools

# Database Schema

# **Raffle Royale — Database Schema (MVP → Scalable)**

## **1\. High‑Level Entity Diagram**

This is the conceptual structure:

Code  
Users ───\< Raffles ───\< Tickets \>─── Users  
   │             │  
   │             └──\< RaffleEvents  
   │  
   └──\< Payouts

# **2\. Core Tables**

## **• Users**

Stores identity, KYC status, and account metadata.

**Columns**

* `id` (PK, UUID)  
* `email` (unique)  
* `phone`  
* `password_hash`  
* `kyc_status` (pending/verified/rejected)  
* `created_at`  
* `updated_at`

**Notes**

* Rafflers and participants are the same entity; roles are contextual.  
* KYC only required for rafflers.

## **• Raffles**

The heart of the system.

**Columns**

* `id` (PK, UUID)  
* `raffler_id` (FK → Users.id)  
* `title`  
* `description`  
* `item_type` (physical/digital)  
* `total_tickets`  
* `ticket_price`  
* `tickets_sold` (counter)  
* `min_sell_through` (nullable)  
* `status` (draft/active/sold\_out/expired/disbanded/completed)  
* `start_time`  
* `end_time`  
* `created_at`  
* `updated_at`

**Indexes**

* `(status, end_time)` for expiration cron  
* `(raffler_id)` for profile pages

**Notes**

* `tickets_sold` is incremented atomically during purchase.  
* `status` transitions must be deterministic (state machine).

## **• Tickets**

Represents a purchased ticket.

**Columns**

* `id` (PK, UUID)  
* `raffle_id` (FK → Raffles.id)  
* `buyer_id` (FK → Users.id)  
* `ticket_number` (int)  
* `transaction_id` (FK → Transactions.id)  
* `created_at`

**Indexes**

* `(raffle_id, ticket_number)` unique  
* `(buyer_id)` for user history

**Notes**

* Ticket numbers are assigned sequentially.  
* This table is the source of truth for winner selection.

## **• Transactions**

Tracks payments for tickets.

**Columns**

* `id` (PK, UUID)  
* `user_id` (FK → Users.id)  
* `raffle_id` (FK → Raffles.id)  
* `amount`  
* `currency`  
* `stripe_payment_intent_id`  
* `status` (pending/succeeded/failed/refunded)  
* `created_at`

**Notes**

* Every ticket purchase creates a transaction.  
* Refunds update this table and trigger Stripe API calls.

## **• Payouts**

Tracks money released to rafflers.

**Columns**

* `id` (PK, UUID)  
* `raffle_id` (FK → Raffles.id)  
* `raffler_id` (FK → Users.id)  
* `amount`  
* `stripe_transfer_id`  
* `status` (pending/sent/failed)  
* `created_at`

**Notes**

* Triggered only after winner confirmation or dispute window.

## **• RaffleEvents**

Audit log for transparency and fraud prevention.

**Columns**

* `id` (PK, UUID)  
* `raffle_id` (FK → Raffles.id)  
* `event_type` (created/ticket\_purchased/sold\_out/expired/winner\_selected/disbanded/payout\_sent)  
* `metadata` (JSONB)  
* `created_at`

**Notes**

* This is your “black box recorder.”  
* Essential for disputes and admin tools.

# **3\. Optional (But Smart) Tables**

## **• DigitalGoods**

Only if you support digital items.

**Columns**

* `raffle_id` (PK, FK → Raffles.id)  
* `delivery_type` (email/code/manual\_transfer)  
* `encrypted_payload` (nullable)  
* `delivered_at`

## **• PromotionPurchases**

For sponsored raffles.

**Columns**

* `id` (PK)  
* `raffle_id`  
* `amount`  
* `promotion_type`  
* `start_time`  
* `end_time`

# **4\. Non‑Obvious Engineering Decisions (Important)**

### **1\. Use UUIDs everywhere**

Avoids sequential ID guessing and makes sharding easier later.

### **2\. Store money as integers**

Use cents, not floats:

* `amount_cents INT`

### **3\. Use row‑level locking for ticket purchases**

During purchase:

Code  
SELECT \* FROM raffles WHERE id \= $1 FOR UPDATE;

Prevents overselling.

### **4\. Use a state machine for raffle status**

Valid transitions only:

Code  
draft → active → sold\_out → completed  
active → expired → disbanded

### **5\. Use JSONB for flexible metadata**

Especially in `RaffleEvents`.

# **5\. Schema Evolution Path (MVP → Scale)**

### **MVP**

* Postgres only  
* Simple cron for expiration  
* Row‑level locks for purchases

### **Later**

* Redis caching for ticket counts  
* Event‑driven architecture  
* Sharded raffles table  
* Read replicas for analytics  
* Kafka/NATS for purchase events

# GraphQL API

# **Raffle Royale — GraphQL API Design**

## **1\. High‑Level API Philosophy**

**Concise takeaway:**  

GraphQL should expose **clean, predictable types**, a **strict raffle state machine**, and **transaction‑safe mutations** for ticket purchases.

**Design goals**

* Strong typing for trust & transparency  
* Minimal over‑fetching  
* Mutations that enforce business rules  
* Queries optimized for the UI (raffle list, raffle detail, user dashboard)  
* Future‑proof for real‑time subscriptions

# **2\. Core GraphQL Types**

## **• User**

graphql  
type User {  
  id: ID\!  
  email: String\!  
  phone: String  
  kycStatus: KycStatus\!  
  createdAt: DateTime\!  
  raffles: \[Raffle\!\]\!  
  tickets: \[Ticket\!\]\!  
}

## **• Raffle**

graphql  
type Raffle {  
  id: ID\!  
  raffler: User\!  
  title: String\!  
  description: String  
  itemType: ItemType\!  
  totalTickets: Int\!  
  ticketsSold: Int\!  
  ticketPrice: Int\! \# cents  
  minSellThrough: Int  
  status: RaffleStatus\!  
  startTime: DateTime\!  
  endTime: DateTime\!  
  tickets: \[Ticket\!\]\!  
  events: \[RaffleEvent\!\]\!  
}

## **• Ticket**

graphql  
type Ticket {  
  id: ID\!  
  raffle: Raffle\!  
  buyer: User\!  
  ticketNumber: Int\!  
  createdAt: DateTime\!  
}

## **• Transaction**

graphql  
type Transaction {  
  id: ID\!  
  user: User\!  
  raffle: Raffle\!  
  amount: Int\!  
  status: TransactionStatus\!  
  createdAt: DateTime\!  
}

## **• RaffleEvent**

graphql  
type RaffleEvent {  
  id: ID\!  
  raffle: Raffle\!  
  eventType: RaffleEventType\!  
  metadata: JSON  
  createdAt: DateTime\!  
}

# **3\. Enums (Critical for State Machine)**

## **• RaffleStatus**

graphql  
enum RaffleStatus {  
  DRAFT  
  ACTIVE  
  SOLD\_OUT  
  EXPIRED  
  DISBANDED  
  COMPLETED  
}

## **• ItemType**

graphql  
enum ItemType {  
  PHYSICAL  
  DIGITAL  
}

## **• KycStatus**

graphql  
enum KycStatus {  
  PENDING  
  VERIFIED  
  REJECTED  
}

# **4\. Queries (Frontend‑Driven)**

## **• raffle(id)**

Fetch a single raffle.

graphql  
type Query {  
  raffle(id: ID\!): Raffle  
}

## **• raffles(filter)**

Used for homepage, discovery, and search.

graphql  
type Query {  
  raffles(  
    status: RaffleStatus  
    itemType: ItemType  
    rafflerId: ID  
    limit: Int \= 20  
    offset: Int \= 0  
  ): \[Raffle\!\]\!  
}

## **• me**

User dashboard.

graphql  
type Query {  
  me: User  
}

# **5\. Mutations (Where the Real Engineering Happens)**

## **• createRaffle**

graphql  
input CreateRaffleInput {  
  title: String\!  
  description: String  
  itemType: ItemType\!  
  totalTickets: Int\!  
  ticketPrice: Int\!  
  minSellThrough: Int  
  endTime: DateTime\!  
}

type Mutation {  
  createRaffle(input: CreateRaffleInput\!): Raffle\!  
}

## **• purchaseTicket**

This is the mutation that must enforce atomicity.

graphql  
input PurchaseTicketInput {  
  raffleId: ID\!  
  quantity: Int\!  
  paymentMethodId: String\! \# Stripe  
}

type Mutation {  
  purchaseTicket(input: PurchaseTicketInput\!): \[Ticket\!\]\!  
}

**Backend responsibilities**

* Lock raffle row  
* Check availability  
* Create Stripe payment intent  
* Insert tickets  
* Increment ticketsSold  
* Emit RaffleEvent

## **• completeRaffle**

Triggered by cron or event system.

graphql  
type Mutation {  
  completeRaffle(raffleId: ID\!): Raffle\!  
}

## **• disbandRaffle**

Refunds all participants.

graphql  
type Mutation {  
  disbandRaffle(raffleId: ID\!): Raffle\!  
}

## **• confirmDelivery**

Winner confirms they received the item.

graphql  
type Mutation {  
  confirmDelivery(raffleId: ID\!): Boolean\!  
}

# **6\. Subscriptions (Future, Not MVP)**

## **• ticketPurchased**

graphql  
type Subscription {  
  ticketPurchased(raffleId: ID\!): Ticket\!  
}

## **• raffleUpdated**

graphql  
type Subscription {  
  raffleUpdated(raffleId: ID\!): Raffle\!  
}

These power real‑time UI updates later.

# **7\. Non‑Obvious GraphQL Engineering Decisions**

### **1\. Mutations return full objects**

Returning the updated `Raffle` or `Ticket[]` reduces round‑trips.

### **2\. Use DataLoader for N+1 prevention**

Especially for:

* `raffle.raffler`  
* `raffle.tickets`  
* `ticket.buyer`

### **3\. Use field‑level authorization**

Example:

* Only the raffler can see payout info  
* Only the winner can confirm delivery

### **4\. Use custom scalars**

* `DateTime`  
* `JSON`  
* `Money` (optional)

### **5\. Keep mutations thin**

Business logic belongs in services, not resolvers.

# Event Driven Data

# **Event‑Driven Architecture for Raffle Royale (No Cron, No Servers)**

## **1\. Core Idea**

Instead of a cron job scanning the database every minute, we emit **events** at the exact moments when something needs to happen:

* A raffle is created → schedule an expiration event  
* A ticket is purchased → check for sellout  
* A raffle sells out → trigger winner selection  
* A raffle expires → trigger disbanding  
* A winner confirms delivery → trigger payout

Everything becomes **reactive**, not **polling**.

# **2\. Event Sources (How Events Enter the System)**

## **• RaffleCreated → ScheduleExpiration**

When a raffle is created, the backend emits:

Code  
RaffleCreated { raffleId, endTime }

This event is sent to a scheduler service (see below).

## **• TicketPurchased → CheckSellout**

When a ticket is purchased:

Code  
TicketPurchased { raffleId, ticketsSold, totalTickets }

If `ticketsSold == totalTickets`, emit:

Code  
RaffleSoldOut { raffleId }

## **• RaffleSoldOut → SelectWinner**

This triggers the winner selection workflow.

## **• RaffleExpired → DisbandRaffle**

If the expiration event fires before sellout, the raffle is disbanded.

# **3\. How to Schedule Future Events (Without Cron)**

This is the key part. You have **three excellent options** that work beautifully with Fargate or Cloud Run.

## **Option A — Cloud Scheduler → Pub/Sub → Cloud Run**

(If using Google Cloud)

* Cloud Scheduler schedules a one‑off job  
* Publishes a message to Pub/Sub at the exact time  
* Pub/Sub triggers Cloud Run with the event payload

This is **fully serverless** and extremely reliable.

## **Option B — EventBridge Scheduler (AWS)**

(If using AWS)

* EventBridge Scheduler creates a one‑time scheduled event  
* At `endTime`, it triggers a Lambda or Fargate task  
* That task processes the expiration

This is the cleanest AWS-native solution.

## **Option C — Delayed Messages in a Queue**

(Cloud‑agnostic)

Use a queue that supports delayed delivery:

* AWS SQS (with DelaySeconds)  
* RabbitMQ delayed exchange  
* Kafka with message timestamp

When a raffle is created:

Code  
Send message: { raffleId } with delay \= endTime \- now

When the message arrives, the raffle expires.

This is elegant and avoids any scheduler service.

# **4\. Event Processing (How Events Trigger Logic)**

Each event type maps to a small, stateless container that Cloud Run or Fargate can spin up on demand.

### **• ProcessRaffleExpiration**

* Check raffle status  
* If still active → disband  
* Emit `RaffleDisbanded`

### **• ProcessRaffleSoldOut**

* Select winner  
* Emit `WinnerSelected`

### **• ProcessWinnerSelected**

* Notify winner  
* Notify raffler  
* Start delivery workflow

### **• ProcessDeliveryConfirmed**

* Trigger payout  
* Emit `PayoutSent`

Everything is modular and stateless.

# **5\. Why Event‑Driven Beats Cron (Especially for Raffle Royale)**

### **1\. No polling**

Cron wastes compute scanning for expired raffles.

Event‑driven fires *exactly once* at the right time.

### **2\. No servers**

Cloud Run / Fargate spin up only when needed.

### **3\. Perfect for concurrency**

Ticket purchases become events → easy to scale horizontally.

### **4\. Perfect for auditability**

Every event is logged in `RaffleEvents`.

### **5\. Perfect for future real‑time features**

Subscriptions, WebSockets, push notifications — all event‑driven.

# **6\. Recommended Architecture (Best Fit for You)**

Since you prefer containerization and managed platforms, the best architecture is:

### **AWS Version**

* **Fargate** for API \+ workers  
* **EventBridge Scheduler** for expiration events  
* **SQS** for ticket purchase events  
* **Lambda** for lightweight event processors  
* **Postgres (RDS)** for data  
* **Redis (ElastiCache)** later for caching

### **GCP Version**

* **Cloud Run** for API \+ workers  
* **Cloud Tasks** or **Cloud Scheduler** for expiration  
* **Pub/Sub** for event streams  
* **Cloud SQL (Postgres)**  
* **MemoryStore (Redis)** later

Both are clean, scalable, and cron‑free.

# How to choose winner

# How to choose a winner.

Let’s design this so it’s **fair, verifiable, and boringly correct**—the kind of thing people can trust without thinking about it.

### **1\. Core requirements**

* **Uniform randomness:** Every ticket has equal probability 1/N.  
* **Deterministic & auditable:** Given the same inputs, you always get the same winner.  
* **Tamper‑resistant:** No one (including admins) can “nudge” the outcome.  
* **Simple to implement now, upgradeable later** (e.g., external randomness beacons).

### **2\. High‑level algorithm**

When a raffle transitions to `SOLD_OUT` (or meets min sell‑through and is allowed to run):

1. **Fetch all tickets** for that raffle.  
2. **Generate a random index** in \[0,N−1\].  
3. **Select the ticket** at that index as the winner.  
4. **Persist the result** and the randomness inputs.  
5. **Emit a** `WinnerSelected` **event** and log it in `RaffleEvents`.

### **3\. Randomness source (MVP)**

For MVP, use **cryptographically secure RNG** from your runtime:

* Node.js: `crypto.randomInt(0, N)`  
* Or: generate a 256‑bit random value and mod by `N` (with rejection sampling if you want perfect uniformity).

**Pseudo‑code:**

ts  
const tickets \= await db.tickets.findMany({ where: { raffleId } });  
const n \= tickets.length;

if (n \=== 0\) throw new Error("No tickets sold");

const randomIndex \= crypto.randomInt(0, n); // \[0, n)  
const winningTicket \= tickets\[randomIndex\];

// persist  
await db.raffles.update({  
  where: { id: raffleId },  
  data: {  
    status: "COMPLETED",  
    winnerTicketId: winningTicket.id,  
  },  
});

await db.raffleEvents.create({  
  data: {  
    raffleId,  
    eventType: "WINNER\_SELECTED",  
    metadata: {  
      winningTicketId: winningTicket.id,  
      randomIndex,  
      ticketCount: n,  
      algorithm: "crypto.randomInt",  
    },  
  },  
});

### **4\. Making it auditable (even in MVP)**

To build trust, store enough info so users can see *how* the winner was chosen:

* `ticketCount`: number of tickets at selection time.  
* `randomIndex`: the index used.  
* `algorithm`: description/version of the algorithm.  
* `selectedTicketId`: the winner.

Expose this via GraphQL:

graphql  
type WinnerSelectionMetadata {  
  ticketCount: Int\!  
  randomIndex: Int\!  
  algorithm: String\!  
}

extend type Raffle {  
  winnerTicket: Ticket  
  winnerSelection: WinnerSelectionMetadata  
}

This doesn’t let users recompute the RNG, but it shows that the winner is consistent with the stored index and ticket list.

### **5\. Upgrading to externally verifiable randomness (future)**

When you’re ready to go harder on transparency, you can:

**Option A — Randomness beacon (e.g., drand, Chainlink VRF)**

* Use a public randomness source with a known round/epoch.  
* Store:  
  * `randomSeedSource` (e.g., drand round)  
  * `randomSeedValue`  
* Derive `randomIndex = H(seed || raffleId) mod N`.

**Option B — Commit‑reveal scheme**

* On raffle creation, server commits to a secret value `S` (hash stored).  
* On sellout, combine:  
  * `S`  
  * A public value (e.g., block hash, beacon value, timestamp bucket)  
* Compute:  
  * `R = H(S || publicValue || raffleId)`  
  * `index = R mod N`  
* Reveal `S` and public value so anyone can recompute.

### **6\. Integrating with the event‑driven system**

When `RaffleSoldOut` (or “ready to run”) event fires:

1. **Handler** loads tickets and raffle.  
2. **Checks idempotency**: if `winnerTicketId` already set, exit.  
3. **Runs selection algorithm**.  
4. **Writes result in a single transaction**:  
   * Set `winnerTicketId`  
   * Set `status = COMPLETED`  
   * Insert `WINNER_SELECTED` event  
5. **Emits** `WinnerSelected` **event** for notifications.

This keeps the process:

* **Atomic**  
* **Idempotent**  
* **Traceable**

# Commit-reveal, trusted Random

Let’s design a **commit–reveal \+ public randomness** scheme that:

* Makes cheating *provably hard*  
* Is understandable to normal humans  
* Fits cleanly into your existing data model and event‑driven architecture

### **1\. What we’re trying to guarantee**

* The platform **cannot choose the winner after seeing who bought tickets**.  
* The platform **cannot predict** the final random value at raffle creation.  
* Anyone can **recompute the winner** from public data \+ stored values.

So we combine:

* A **server secret** (committed early, revealed later)  
* A **public randomness source** (not controlled by you)  
* A **deterministic function** that maps those to a ticket index

### **2\. High‑level flow**

#### **At raffle creation (commit)**

1. Server generates a random secret `S` (256 bits).  
2. Compute `C = hash(S)` (e.g., `SHA-256`).  
3. Store `C` on the raffle as `commitmentHash`.  
4. Do **not** store `S` in plain text yet (or store encrypted).

Users can see:

“This raffle has a pre‑committed randomness hash: `C`.”

They can’t derive `S` from `C`.

#### **At raffle resolution (reveal \+ derive)**

When the raffle is ready to run (sold out or meets rules):

1. Fetch:  
   * `S` (secret)  
   * `C` (commitment hash)  
   * Public randomness value `R_pub` (from beacon or similar)  
   * `raffleId`  
   * Ordered list of ticket IDs (or deterministic ordering rule)  
2. Verify `hash(S) == C`. If not, abort (this would be a huge red flag).  
3. Compute combined randomness:

R=H(S ∥ Rpub ∥ raffleId)

4. Interpret `R` as a big integer and compute:

index=R  N

where N is the number of tickets.

5. Select the ticket at `index` as the winner.  
6. Store:  
   * `S` (revealedSecret)  
   * `R_pub` (publicRandomness)  
   * `R` (combinedRandomness)  
   * `index` (winnerIndex)  
   * `winnerTicketId`

Now anyone can recompute the winner.

### **3\. Choosing a public randomness source**

You want something:

* Public  
* Unbiased (or at least hard to bias)  
* Timestamped / round‑based

Good options:

* **drand** (distributed randomness beacon)  
* **Chainlink VRF** (if you’re comfortable touching blockchain infra)  
* A **block hash** from a major chain (e.g., Ethereum block at/after endTime)

For simplicity, let’s assume **drand**:

* At resolution time, you fetch the latest round randomness `R_pub`.  
* Store:  
  * `randomnessSource = "drand"`  
  * `randomnessRound`  
  * `randomnessValue = R_pub`

### **4\. Data model additions**

Extend `Raffles`:

* `commitment_hash` (string, `C`)  
* `revealed_secret` (string, `S`, nullable until reveal)  
* `public_random_source` (string, e.g., `"drand"`)  
* `public_random_value` (string, `R_pub`)  
* `public_random_round` (string/int)  
* `combined_random_value` (string, `R`)  
* `winner_index` (int)  
* `winner_ticket_id` (FK → Tickets.id)

You also log all of this in `RaffleEvents` under `WINNER_SELECTED`.

### **5\. Concrete algorithm (pseudo‑code)**

#### **Commit (on raffle creation)**

ts  
import crypto from "crypto";

function createRaffle(input) {  
  const S \= crypto.randomBytes(32).toString("hex"); // 256-bit secret  
  const C \= crypto.createHash("sha256").update(S).digest("hex");

  // Store S encrypted or in a secure secrets store  
  const encryptedS \= encryptForDB(S);

  return db.raffles.create({  
    data: {  
      ...input,  
      commitmentHash: C,  
      revealedSecret: encryptedS, // or store elsewhere  
    },  
  });  
}

You might choose to store `S` in a separate secure store and only link it by `raffleId`.

#### **Reveal \+ select winner (on resolution)**

ts  
async function resolveRaffle(raffleId: string) {  
  return db.$transaction(async (tx) \=\> {  
    const raffle \= await tx.raffles.findUnique({ where: { id: raffleId } });  
    if (\!raffle) throw new Error("Raffle not found");  
    if (raffle.status \!== "SOLD\_OUT" && raffle.status \!== "READY\_TO\_RUN") {  
      throw new Error("Raffle not ready");  
    }

    const tickets \= await tx.tickets.findMany({  
      where: { raffleId },  
      orderBy: { id: "asc" }, // deterministic ordering  
    });

    const N \= tickets.length;  
    if (N \=== 0\) throw new Error("No tickets sold");

    const S \= decryptFromDB(raffle.revealedSecret);  
    const C \= raffle.commitmentHash;

    const recomputedC \= crypto.createHash("sha256").update(S).digest("hex");  
    if (recomputedC \!== C) {  
      throw new Error("Commitment mismatch");  
    }

    // Fetch public randomness (e.g., drand)  
    const { round, randomness: R\_pub } \= await fetchDrandRandomness();

    const R \= crypto  
      .createHash("sha256")  
      .update(S \+ R\_pub \+ raffle.id)  
      .digest("hex");

    const RBigInt \= BigInt("0x" \+ R);  
    const index \= Number(RBigInt % BigInt(N));  
    const winningTicket \= tickets\[index\];

    await tx.raffles.update({  
      where: { id: raffleId },  
      data: {  
        status: "COMPLETED",  
        winnerTicketId: winningTicket.id,  
        revealedSecret: S, // now stored in plain or marked as revealed  
        publicRandomSource: "drand",  
        publicRandomRound: round,  
        publicRandomValue: R\_pub,  
        combinedRandomValue: R,  
        winnerIndex: index,  
      },  
    });

    await tx.raffleEvents.create({  
      data: {  
        raffleId,  
        eventType: "WINNER\_SELECTED",  
        metadata: {  
          commitmentHash: C,  
          revealedSecret: S,  
          publicRandomSource: "drand",  
          publicRandomRound: round,  
          publicRandomValue: R\_pub,  
          combinedRandomValue: R,  
          winnerIndex: index,  
          ticketCount: N,  
          winningTicketId: winningTicket.id,  
        },  
      },  
    });

    return winningTicket;  
  });  
}

### **6\. How users can verify it**

On the raffle “Fairness” tab, you show:

* `commitmentHash`  
* `revealedSecret`  
* `publicRandomSource`, `publicRandomRound`, `publicRandomValue`  
* `combinedRandomValue`  
* `winnerIndex`  
* Ordered list of ticket IDs

You can even provide a **“Verify locally”** code snippet (JS or Python) so anyone can:

1. Recompute `hash(S)` and confirm it matches `commitmentHash`.  
2. Recompute `R = H(S || R_pub || raffleId)`.  
3. Compute `index = R mod N`.  
4. Confirm that the ticket at that index is the winner.

That’s *chef’s kiss* transparency.

### **7\. How this fits your event‑driven system**

* `RaffleSoldOut` event → triggers `ResolveRaffle` worker.  
* Worker runs the commit‑reveal algorithm above.  
* Emits `WinnerSelected` event with all metadata.  
* GraphQL exposes the result \+ fairness data.

No cron, no long‑running servers, fully stateless workers.

# Infra Overview

# **Raffle Royale — AWS Infrastructure Architecture (Container‑Native, Event‑Driven)**

## **1\. High‑Level Architecture Overview**

The entire system is built around **stateless containers**, **managed databases**, and **event‑driven workflows**.

### **Core components:**

* **ECS Fargate** for API \+ background workers  
* **AWS RDS Postgres** for the database  
* **AWS SQS** for event queues  
* **EventBridge Scheduler** for raffle expiration events  
* **AWS Lambda** for lightweight event processors  
* **AWS Secrets Manager** for secrets (commit‑reveal secret storage)  
* **AWS CloudWatch Logs** for logs  
* **GitHub Actions** for CI/CD  
* **Docker Compose** for local development

Everything is fully managed. No servers. No cron. No SSH. No patching.

# **2\. Container Strategy**

## **• API Container**

Runs:

* GraphQL API  
* Authentication  
* Ticket purchase logic  
* Raffle creation  
* Commit‑reveal commitment generation

Runs on **ECS Fargate** behind an **Application Load Balancer**.

## **• Worker Container**

Processes:

* Ticket purchase events  
* RaffleSoldOut events  
* Winner selection  
* Delivery confirmation  
* Payout triggers

Runs as **Fargate tasks** triggered by SQS or EventBridge.

## **• One‑off Task Container**

Used for:

* Raffle expiration  
* Backfills  
* Maintenance jobs

Triggered by **EventBridge Scheduler**.

# **3\. Event‑Driven Workflow (No Cron)**

## **• TicketPurchased → SQS**

API publishes a message to SQS:

Code  
TicketPurchased { raffleId, ticketsSold, totalTickets }

Worker consumes it and checks for sellout.

## **• RaffleCreated → EventBridge Scheduler**

When a raffle is created:

* API schedules a **one‑time EventBridge rule** at `endTime`  
* That rule triggers a Fargate task or Lambda  
* That task emits `RaffleExpired`

No cron. No polling.

## **• RaffleSoldOut → WinnerSelection**

Worker triggers the commit‑reveal winner selection algorithm.

## **• WinnerSelected → Notifications**

Worker publishes:

* Push notifications  
* Emails  
* GraphQL subscription events (future)

# **4\. Database Layer (RDS Postgres)**

## **• Primary DB**

* RDS Postgres  
* Multi‑AZ  
* Automated backups  
* Parameter group tuned for row‑level locking

## **• Future Read Replicas**

For analytics, dashboards, and heavy reads.

# **5\. Secrets & Config**

## **• AWS Secrets Manager**

Stores:

* Commit‑reveal secrets (encrypted)  
* Stripe keys  
* JWT signing keys  
* Database credentials

## **• AWS Parameter Store**

Stores:

* Environment variables  
* Feature flags  
* Config values

# **6\. Networking & Security**

## **• VPC**

* Private subnets for Fargate tasks  
* Public subnets for ALB  
* NAT gateway for outbound traffic

## **• Security Groups**

* API → DB  
* Worker → DB  
* ALB → API  
* No public DB access

## **• IAM Roles**

* Task roles for API and workers  
* Least privilege for SQS, EventBridge, Secrets Manager

# **7\. CI/CD Pipeline (GitHub Actions)**

## **• Build Stage**

* Lint  
* Test  
* Build Docker images  
* Tag with commit SHA

## **• Push to ECR**

* Authenticate to AWS  
* Push images to ECR

## **• Deploy Stage**

* Update ECS service with new image  
* Trigger rolling deployment  
* Run DB migrations (via one‑off task)

This gives you **zero‑downtime deployments**.

# **8\. Local Development (Docker Compose)**

## **• Services**

* API container  
* Worker container  
* Postgres  
* Redis (optional)  
* Localstack (optional) for SQS/EventBridge emulation

## **• Hot Reloading**

Bind‑mount source code into containers.

## **• Local Secrets**

Use `.env` files (ignored by Git).

# **9\. Full Architecture Diagram (Text Version)**

Code  
                  ┌──────────────────────────┐  
                   │      GitHub Actions      │  
                   │  CI/CD → Build & Deploy  │  
                   └─────────────┬────────────┘  
                                 │  
                                 ▼  
                        ┌────────────────┐  
                        │      ECR       │  
                        └───────┬────────┘  
                                │  
                ┌──────────────┴────────────────┐  
                │                                 │  
                ▼                                 ▼  
      ┌──────────────────┐              ┌──────────────────┐  
      │   ECS Fargate     │              │   ECS Fargate     │  
      │     (API)         │              │    (Workers)      │  
      └─────────┬─────────┘              └─────────┬─────────┘  
                │                                    │  
                ▼                                    ▼  
      ┌──────────────────┐                ┌────────────────────┐  
      │ Application LB    │                │ SQS Event Queues    │  
      └──────────────────┘                └────────────────────┘  
                │                                    │  
                ▼                                    ▼  
      ┌──────────────────┐                ┌────────────────────┐  
      │   Users / Clients │                │ EventBridge Scheduler│  
      └──────────────────┘                └────────────────────┘  
                                                     │  
                                                     ▼  
                                           ┌──────────────────┐  
                                           │  Lambda / Fargate │  
                                           │  Expiration Tasks │  
                                           └──────────────────┘

                        ┌────────────────────────────────────────┐  
                        │              RDS Postgres               │  
                        └────────────────────────────────────────┘

                        ┌────────────────────────────────────────┐  
                        │           Secrets Manager               │  
                        └────────────────────────────────────────┘

# 

# Pipeline

# **Raffle Royale — GitHub Actions CI/CD Pipeline (AWS, Docker, ECS Fargate)**

## **1\. Pipeline Philosophy**

**Concise takeaway:**  

Build once → test → push Docker images → deploy to ECS → run DB migrations → verify health → roll out.

This pipeline is:

* Fully automated  
* Zero‑downtime  
* Uses GitHub Actions OIDC (no long‑lived AWS keys)  
* Works for both API and worker containers  
* Compatible with your event‑driven architecture

# **2\. Pipeline Stages**

## **• 1\. Trigger Conditions**

You’ll typically trigger on:

* Push to `main`  
* Pull requests (build \+ test only)  
* Manual deploys (workflow\_dispatch)

## **• 2\. Build & Test**

Steps:

* Checkout repo  
* Set up Node.js  
* Install dependencies  
* Run tests  
* Build Docker images (API \+ worker)  
* Tag images with `sha`

## **• 3\. Authenticate to AWS via OIDC**

This avoids storing AWS keys in GitHub.

GitHub → AWS IAM Role → ECR \+ ECS permissions.

## **• 4\. Push Images to ECR**

Push both:

* `raffle-royale-api:<sha>`  
* `raffle-royale-worker:<sha>`

## **• 5\. Deploy to ECS Fargate**

Update ECS service(s):

* API service  
* Worker service

ECS performs a rolling deployment:

* Spins up new tasks  
* Waits for health checks  
* Drains old tasks

## **• 6\. Run Database Migrations**

Run migrations as a **one‑off ECS task** using the same image.

This ensures:

* Migrations run in the same environment as production  
* No drift  
* No manual intervention

## **• 7\. Post‑Deploy Smoke Tests**

Optional but recommended:

* Hit `/health`  
* Hit `/graphql` introspection  
* Validate DB connectivity

# **3\. Full GitHub Actions Workflow (Production‑Ready)**

Below is a complete pipeline you can drop into `.github/workflows/deploy.yml`.

It includes:

* OIDC auth  
* Multi‑image build  
* ECR push  
* ECS deploy  
* One‑off migration task

yaml  
name: Deploy Raffle Royale

on:  
  push:  
    branches: \[ "main" \]  
  workflow\_dispatch:

jobs:  
  deploy:  
    name: Build, Push, Deploy  
    runs-on: ubuntu-latest  
    permissions:  
      id-token: write  
      contents: read

    env:  
      AWS\_REGION: us-east-1  
      ECR\_REGISTRY: ${{ secrets.AWS\_ACCOUNT\_ID }}.dkr.ecr.${{ env.AWS\_REGION }}.amazonaws.com  
      API\_IMAGE: raffle-royale-api  
      WORKER\_IMAGE: raffle-royale-worker

    steps:  
      \- name: Checkout  
        uses: actions/checkout@v4

      \- name: Configure AWS Credentials (OIDC)  
        uses: aws-actions/configure-aws-credentials@v4  
        with:  
          role-to-assume: arn:aws:iam::${{ secrets.AWS\_ACCOUNT\_ID }}:role/github-actions-deploy  
          aws-region: ${{ env.AWS\_REGION }}

      \- name: Login to ECR  
        uses: aws-actions/amazon-ecr-login@v2

      \- name: Build API Image  
        run: |  
          docker build \-t $API\_IMAGE:${{ github.sha }} \-f api/Dockerfile api

      \- name: Build Worker Image  
        run: |  
          docker build \-t $WORKER\_IMAGE:${{ github.sha }} \-f worker/Dockerfile worker

      \- name: Tag & Push API Image  
        run: |  
          docker tag $API\_IMAGE:${{ github.sha }} $ECR\_REGISTRY/$API\_IMAGE:${{ github.sha }}  
          docker push $ECR\_REGISTRY/$API\_IMAGE:${{ github.sha }}

      \- name: Tag & Push Worker Image  
        run: |  
          docker tag $WORKER\_IMAGE:${{ github.sha }} $ECR\_REGISTRY/$WORKER\_IMAGE:${{ github.sha }}  
          docker push $ECR\_REGISTRY/$WORKER\_IMAGE:${{ github.sha }}

      \- name: Update ECS Service (API)  
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2  
        with:  
          task-definition: ecs/api-task-def.json  
          service: raffle-royale-api  
          cluster: raffle-royale  
          image: $ECR\_REGISTRY/$API\_IMAGE:${{ github.sha }}

      \- name: Update ECS Service (Worker)  
        uses: aws-actions/amazon-ecs-deploy-task-definition@v2  
        with:  
          task-definition: ecs/worker-task-def.json  
          service: raffle-royale-worker  
          cluster: raffle-royale  
          image: $ECR\_REGISTRY/$WORKER\_IMAGE:${{ github.sha }}

      \- name: Run DB Migrations (One-Off Task)  
        run: |  
          aws ecs run-task \\  
            \--cluster raffle-royale \\  
            \--launch-type FARGATE \\  
            \--task-definition raffle-royale-migrations \\  
            \--network-configuration "awsvpcConfiguration={subnets=\[subnet-123\],securityGroups=\[sg-123\],assignPublicIp=DISABLED}"

# **4\. Why This Pipeline Is Excellent**

### **1\. Zero AWS keys in GitHub**

OIDC is the modern, secure way.

### **2\. Build once, deploy everywhere**

Images are immutable and tagged by commit SHA.

### **3\. ECS handles rolling deploys**

No downtime, no manual intervention.

### **4\. Migrations run in a container**

No “developer laptop drift,” no SSH, no EC2.

### **5\. Easy rollback**

Just redeploy a previous SHA.

### **6\. Extensible**

You can add:

* Canary deploys  
* Blue/green  
* Integration tests  
* Slack notifications

# ECS Frontend

# **Next.js ECS Task Definition (Fargate, Docker, AWS‑Native)**

## **1\. What the Next.js Task Needs to Do**

**Concise takeaway:**  

Run `next start` inside a container, expose port 3000, integrate with ALB, and load env vars securely.

Your Next.js container must support:

* SSR (server‑side rendering)  
* Static asset serving  
* API routes (if used)  
* Health checks  
* Environment variables (NEXT\_PUBLIC\_\*)  
* Logging to CloudWatch  
* Zero‑downtime rolling deploys

# **2\. Dockerfile for Next.js (Production‑Optimized)**

This is the Dockerfile your ECS task definition will reference.

Dockerfile  
FROM node:20-alpine AS builder

WORKDIR /app

COPY package\*.json ./  
RUN npm install \--production=false

COPY . .  
RUN npm run build

FROM node:20-alpine AS runner  
WORKDIR /app

ENV NODE\_ENV=production

COPY \--from=builder /app/package\*.json ./  
COPY \--from=builder /app/node\_modules ./node\_modules  
COPY \--from=builder /app/.next ./.next  
COPY \--from=builder /app/public ./public

EXPOSE 3000  
CMD \["npm", "start"\]

This produces a clean, production‑ready image.

# **3\. ECS Task Definition (JSON Structure)**

Below is the **canonical ECS Fargate task definition** for your Next.js frontend.

Each section begins with a Guided Link so you can expand it.

### **• Task Definition Metadata**

json  
{  
  "family": "raffle-royale-frontend",  
  "networkMode": "awsvpc",  
  "requiresCompatibilities": \["FARGATE"\],  
  "cpu": "512",  
  "memory": "1024",

### **• Container Definition**

json  
 "containerDefinitions": \[  
    {  
      "name": "frontend",  
      "image": "\<ECR\>/raffle-royale-frontend:\<sha\>",  
      "portMappings": \[  
        {  
          "containerPort": 3000,  
          "protocol": "tcp"  
        }  
      \],

### **• Environment Variables**

json  
     "environment": \[  
        { "name": "NODE\_ENV", "value": "production" },  
        { "name": "NEXT\_PUBLIC\_API\_URL", "value": "https://api.raffleroyale.com" }  
      \],

### **• Secrets from Secrets Manager**

json  
     "secrets": \[  
        {  
          "name": "INTERNAL\_API\_KEY",  
          "valueFrom": "arn:aws:secretsmanager:us-east-1:123456789:secret:internal-api-key"  
        }  
      \],

### **• Logging Configuration**

json  
     "logConfiguration": {  
        "logDriver": "awslogs",  
        "options": {  
          "awslogs-group": "/ecs/raffle-royale-frontend",  
          "awslogs-region": "us-east-1",  
          "awslogs-stream-prefix": "ecs"  
        }  
      },

### **• Health Check**

Next.js exposes `/` reliably, but better to add a custom `/health` route.

json  
     "healthCheck": {  
        "command": \["CMD-SHELL", "wget \-qO- http://localhost:3000/health || exit 1"\],  
        "interval": 30,  
        "timeout": 5,  
        "retries": 3,  
        "startPeriod": 10  
      }

### **• Final Task Definition Closing**

json  
     "essential": true  
    }  
  \]  
}

# **4\. ECS Service Configuration (Frontend)**

Your Next.js ECS service will look like this:

### **• Frontend ECS Service**

* Launch type: Fargate  
* Desired count: 2 (for redundancy)  
* Load balancer: ALB  
* Target group health check: `/health`  
* Autoscaling: CPU \> 60%

### **Path‑based routing (recommended)**

Use a **single ALB**:

| Path | Target Group |
| ----- | ----- |
| `/` | Next.js frontend |
| `/graphql` | API service |
| `/api/*` | API service |

This keeps your infra clean and cheap.

# **5\. How It Fits Into Your CI/CD Pipeline**

Your GitHub Actions pipeline already builds \+ pushes images \+ updates ECS.

You simply add:

### **Build step**

yaml  
\- name: Build Frontend Image  
  run: |  
    docker build \-t raffle-royale-frontend:${{ github.sha }} \-f frontend/Dockerfile frontend

### **Push step**

yaml  
\- name: Push Frontend Image  
  run: |  
    docker tag raffle-royale-frontend:${{ github.sha }} $ECR\_REGISTRY/raffle-royale-frontend:${{ github.sha }}  
    docker push $ECR\_REGISTRY/raffle-royale-frontend:${{ github.sha }}

### **Deploy step**

yaml  
\- name: Update ECS Service (Frontend)  
  uses: aws-actions/amazon-ecs-deploy-task-definition@v2  
  with:  
    task-definition: ecs/frontend-task-def.json  
    service: raffle-royale-frontend  
    cluster: raffle-royale  
    image: $ECR\_REGISTRY/raffle-royale-frontend:${{ github.sha }}

Zero downtime. Fully automated.

# **6\. Why This Architecture Works Perfectly**

* **Consistent**: All services run on ECS Fargate  
* **Scalable**: Autoscaling based on CPU or latency  
* **Secure**: Secrets Manager \+ IAM task roles  
* **Performant**: ALB \+ containerized SSR  
* **Simple**: One CI/CD pipeline for all services  
* **Future‑proof**: Easy to add CloudFront later

# ECS API

# **Raffle Royale — ECS Service Definitions (API \+ Worker)**

## **1\. Overview**

You will run **two ECS services**, both on **Fargate**:

### **• API Service**

* Long‑running  
* Behind an ALB  
* Handles GraphQL, auth, ticket purchases, raffle creation

### **• Worker Service**

* Event‑driven  
* Consumes SQS messages  
* Runs winner selection, expiration handling, payouts

Both use:

* Docker images from ECR  
* IAM task roles  
* VPC networking  
* CloudWatch logs  
* Autoscaling

# **2\. ECS Task Definitions (Core Building Blocks)**

## **• API Task Definition**

Key properties:

* CPU: 512  
* Memory: 1024  
* Port: 8080  
* Health check path: `/health`  
* Environment variables from Parameter Store  
* Secrets from Secrets Manager  
* Logging to CloudWatch  
* Sidecar (optional): X-Ray or OpenTelemetry

### **Example structure (conceptual)**

json  
{  
  "family": "raffle-royale-api",  
  "networkMode": "awsvpc",  
  "requiresCompatibilities": \["FARGATE"\],  
  "cpu": "512",  
  "memory": "1024",  
  "containerDefinitions": \[  
    {  
      "name": "api",  
      "image": "\<ECR\>/raffle-royale-api:\<sha\>",  
      "portMappings": \[{ "containerPort": 8080 }\],  
      "environment": \[  
        { "name": "NODE\_ENV", "value": "production" }  
      \],  
      "secrets": \[  
        { "name": "DATABASE\_URL", "valueFrom": "arn:aws:secretsmanager:..." }  
      \],  
      "logConfiguration": {  
        "logDriver": "awslogs",  
        "options": {  
          "awslogs-group": "/ecs/raffle-royale-api",  
          "awslogs-region": "us-east-1",  
          "awslogs-stream-prefix": "ecs"  
        }  
      }  
    }  
  \]  
}

## **• Worker Task Definition**

Key properties:

* CPU: 256  
* Memory: 512  
* No load balancer  
* Long‑polls SQS  
* Stateless  
* Can scale horizontally

### **Conceptual structure**

json  
{  
  "family": "raffle-royale-worker",  
  "networkMode": "awsvpc",  
  "requiresCompatibilities": \["FARGATE"\],  
  "cpu": "256",  
  "memory": "512",  
  "containerDefinitions": \[  
    {  
      "name": "worker",  
      "image": "\<ECR\>/raffle-royale-worker:\<sha\>",  
      "environment": \[  
        { "name": "QUEUE\_URL", "value": "https://sqs..." }  
      \],  
      "secrets": \[  
        { "name": "DATABASE\_URL", "valueFrom": "arn:aws:secretsmanager:..." }  
      \],  
      "logConfiguration": {  
        "logDriver": "awslogs",  
        "options": {  
          "awslogs-group": "/ecs/raffle-royale-worker",  
          "awslogs-region": "us-east-1",  
          "awslogs-stream-prefix": "ecs"  
        }  
      }  
    }  
  \]  
}

# **3\. ECS Service Definitions**

## **• API Service Definition**

This is the public‑facing service.

### **Key components:**

* **Load balancer:** Application Load Balancer  
* **Target group health checks:** `/health`  
* **Desired count:** 2 tasks (for redundancy)  
* **Autoscaling:** CPU \> 60% → scale out  
* **Deployment type:** Rolling update  
* **Public access:** Yes (via ALB)  
* **Security group:** ALB → API only

### **Conceptual structure**

json  
{  
  "serviceName": "raffle-royale-api",  
  "taskDefinition": "raffle-royale-api",  
  "desiredCount": 2,  
  "launchType": "FARGATE",  
  "loadBalancers": \[  
    {  
      "targetGroupArn": "arn:aws:elasticloadbalancing:...",  
      "containerName": "api",  
      "containerPort": 8080  
    }  
  \],  
  "networkConfiguration": {  
    "awsvpcConfiguration": {  
      "subnets": \["subnet-a", "subnet-b"\],  
      "securityGroups": \["sg-api"\],  
      "assignPublicIp": "DISABLED"  
    }  
  }  
}

## **• Worker Service Definition**

This is the event‑driven backend.

### **Key components:**

* **No load balancer**  
* **Desired count:** 1–3 (autoscaling based on queue depth)  
* **Autoscaling:**  
  * SQS ApproximateNumberOfMessagesVisible \> 50 → scale out  
  * \< 10 → scale in  
* **Security group:** Worker → DB only  
* **Launch type:** Fargate

### **Conceptual structure**

json  
{  
  "serviceName": "raffle-royale-worker",  
  "taskDefinition": "raffle-royale-worker",  
  "desiredCount": 1,  
  "launchType": "FARGATE",  
  "networkConfiguration": {  
    "awsvpcConfiguration": {  
      "subnets": \["subnet-a", "subnet-b"\],  
      "securityGroups": \["sg-worker"\],  
      "assignPublicIp": "DISABLED"  
    }  
  }  
}

# **4\. Autoscaling Policies**

## **• API Autoscaling**

* CPU \> 60% for 2 minutes → \+1 task  
* CPU \< 20% for 5 minutes → \-1 task  
* Min: 2  
* Max: 10

## **• Worker Autoscaling**

Based on SQS queue depth:

* MessagesVisible \> 50 → \+1 worker  
* MessagesVisible \> 200 → \+2 workers  
* MessagesVisible \< 10 → scale down

Min: 1

Max: 10

This ensures winner selection and expiration events never backlog.

# **5\. One‑Off Tasks (Migrations, Expiration, Backfills)**

## **• Migration Task Definition**

Same image as API, but command:

Code  
npm run migrate

Triggered by GitHub Actions after deploy.

## **• Expiration Tasks**

Triggered by EventBridge Scheduler:

Code  
resolveRaffle \--raffleId \<id\>

Runs in a Fargate one‑off task.

# **6\. How This Fits Your CI/CD Pipeline**

Your GitHub Actions pipeline:

* Builds images  
* Pushes to ECR  
* Updates ECS task definitions  
* Updates ECS services  
* Runs migration task

ECS handles:

* Rolling deploys  
* Health checks  
* Autoscaling  
* Task restarts

You get **zero downtime** and **no servers to manage**.

