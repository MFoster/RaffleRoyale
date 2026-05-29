# MVP Gap Review (Prototype Scope)

## Required Prototype Outcomes

For this MVP/prototype, we need:

1. Deployable web + API stack
2. User sign up and log in
3. Raffler can create/list raffles
4. Participants can buy raffle tickets

## Documentation Gaps Identified

### 1) Scope conflict between PRD/TDD and prototype goal

- `docs/PRD.md` and `docs/TDD.md` include Stripe, escrow, payouts, KYC, dispute tooling, and promotion systems.
- Those are valid future roadmap items, but they obscure the immediate prototype target.

### 2) Missing explicit MVP cut line

- No single section clearly states what is **in scope now** vs **deferred**.
- This makes implementation and testing priorities unclear.

### 3) Missing end-to-end user journey definition

- Existing docs describe subsystems, but not a concise flow for:
  - register/login
  - create raffle
  - discover raffle
  - purchase tickets

## MVP In Scope (Now)

- Auth: email/password signup + login
- Raffles: create, read/list, status visibility
- Tickets: authenticated purchase for active raffles
- Basic deployment support (web and API)

## Deferred (Post-Prototype)

- Stripe integration
- Escrow and payout orchestration
- KYC workflow and fraud systems
- Promotions, reputation, and complex admin workflows
- Real-time push updates (polling/manual refresh acceptable for MVP)

## Delivery Notes

- Web app now provides a single-page prototype journey for signup, login, raffle creation, raffle browsing, and ticket purchase.
- This aligns implementation with the MVP cut line above while preserving advanced features as future phases.
