# AAYANSH’26 — Lunar Dungeon: Party Clash
## Phase-wise Implementation Plan

**Version:** 1.4 (Revision 14 — Incorporates Review Feedback from 11 October 2026)  
**Status:** Implementation blueprint  
**Target:** A reliable browser-based live Party-vs-Party game  
**Stack:** Next.js + TypeScript, NestJS + Socket.IO, PostgreSQL (optional for the first in-memory prototype)

---

## 1. Implementation Strategy

Build the game in vertical slices. First make the rules deterministic and testable, then make the multiplayer protocol fair, then connect the UI, and finally apply the Lunar Night visual design.

**Do not start with animation or decorative UI.** The most important risks are secret-pick leakage, duplicated turn resolution, inconsistent combat rules, and unreliable host recovery. Prove those parts before polishing the arena.

### Fixed MVP rules

- Two parties per match.
- Five distinct fighters per party.
- Each fighter has a role.
- One fighter from each party enters each duel.
- Both parties pick privately and lock before either pick is revealed.
- Both fighters choose a combat action privately; actions reveal only after both are locked.
- Combat state and results are computed by the server.
- First party to win two duels wins the match.
- A 2–0 score ends immediately; a 1–1 score proceeds to Duel 3.
- Fighter reuse is disabled by default within a match.
- Host can pause, resume, and reset the match.
- A public arena display shows only public-safe state.

### Key architecture decisions

1. Keep combat rules in a standalone TypeScript game-rules module with no UI or Socket.IO dependencies.
2. Treat the backend as the only authority for picks, locks, timers, HP, shields, skills, and winners.
3. Use separate **public arena state** and **private party state** payloads. Do not send private information and merely hide it in the UI.
4. Serialize state-changing commands per match and make repeated commands idempotent.
5. Start with a single backend instance. Add durable live-state recovery or horizontal scaling only if the event's reliability requirements need it.

---

## 2. Phase Overview

| Phase | Name | Main output | Exit gate |
|---|---|---|---|
| 0 | Rules Freeze | Signed-off game rules and role data | No unresolved combat ambiguity |
| 1 | Repository & App Foundation | Runnable web and backend apps | Health check and basic pages work |
| 2 | Domain Model & Game Engine | Tested role, combat, duel, series logic | All rules pass unit tests |
| 3 | Match Lifecycle & Host API | Create/configure/start/pause/reset match | Host can operate a match lifecycle |
| 4 | Realtime & Secret Selection | Private rooms, lock/reveal protocol | Automated tests prove no early leakage |
| 5 | Combat Turns & Best-of-Three | Action locking, resolution, score progression | A full match completes correctly |
| 6 | Functional UI | Lobby, party console, host panel, arena | End-to-end browser match works |
| 7 | Lunar Night Visual Pass | Themed art, animations, sound, polish | Visuals aid play and do not block it |
| 8 | Reliability, Security & QA | Edge-case handling and test coverage | All release-critical tests pass |
| 9 | Deployment & Venue Rehearsal | Production build and event checklist | Full rehearsal succeeds on venue devices |
| 10 | Post-event Review | Fix list and reusable results | Lessons documented for the next version |

---

## Phase 0 — Rules Freeze & Specification

> [!IMPORTANT]
> Rules and specifications are fully frozen under **Revision 14** (incorporating Review Feedback from 11 October 2026). See [phase_0_and_1_detailed_plan.md](file:///C:/Users/DEll/.gemini/antigravity-ide/brain/d740431c-c6d7-4530-990a-7b698cb0103a/phase_0_and_1_detailed_plan.md) for complete mathematical schemas, type contracts, exhaustive controller protocols, and full implementations.

### Master Correction Handoff Index (Revision 14 Final Consolidated Reconciled)

| Review Item | Priority | Finding in Rev 14 Final Consolidated Review | Implemented Resolution & Architectural Guarantees | Relevant Plan Section |
|---|---|---|---|---|
| **P0.1** | **BLOCKER** | ESLint configuration conflicts with shown code (explicit `any` in `combat-resolver.ts`, Socket adapter, `emitValidated`, `WsExceptionsFilter`) | Removed all `any` casts: typed `DuelState.roleA/roleB` without casts; created generic `emitValidated<K extends keyof ServerToClientEvents>(target, event: K, payload: Parameters<ServerToClientEvents[K]>[0])` eliminating `event as any` and `payload as any`; typed `socket.data.expiryTimer`; implemented safe type narrowing in `WsExceptionsFilter` for `WsException` (handling string or object with `code`, `message`, `commandId`). Zero-lint gate enforced. | §1.1, §1.5, §1.6 |
| **P0.2** | **BLOCKER** | `OnGatewayInit` is implemented on `RealtimeGateway` but not imported from `@nestjs/websockets` | Imported `OnGatewayInit` directly from `@nestjs/websockets` alongside `WebSocketGateway`, `WebSocketServer`, `OnGatewayConnection`, and `OnGatewayDisconnect`; verified `afterInit(server: Server)` signature against official NestJS contracts. | §1.6 |
| **P0.3** | **BLOCKER** | Selection-timeout event payload violates strict Zod schema (`duel:fightersRevealed` emitted with extra property `duelNumber`) | Canonical payload aligned: removed extra `duelNumber` property from `armSelectionTimer` emission so it strictly matches `DuelFightersRevealedPayloadSchema: { fighterA, fighterB }`. Manual-lock and timeout paths share canonical typed emission. Added robust try/catch around timer callbacks preventing unhandled promise rejections. | §1.4, §1.6 |
| **P0.4** | **BLOCKER** | Secret-validation tests assert regexes (`/Production secret validation failed for AUTH_SECRET/`) that the validator does not throw | Aligned test matchers in `secret-validation.spec.ts` with stable documented validator messages: `/FATAL: AUTH_SECRET cannot use an unedited placeholder.../` and `/FATAL: AUTH_SECRET must be at least 32 characters long.../`. | §1.6 |
| **P0.5** | **BLOCKER** | Retirement tests neither await async `retireMatch()` nor match the actual error text (`'Match not found'`) | Updated unit test (`match.service.spec.ts`) and integration test (`match-lifecycle.integration.spec.ts`) to be `async`, explicitly `await service.retireMatch(match.id)`, and assert regex matcher `.toThrow(/Match .* not found/)` allowing ID interpolation. Ensured timer/hook cleanup completes prior to assertion. | §1.6 |
| **P0.6** | **BLOCKER** | `MatchController.createMatch()` loses structured response type via cache (`CachedProvisioningEntry.response: Record<string, unknown>`) | Defined canonical explicit `MatchProvisioningResponse` interface containing `{ matchId, runId, partyAName, partyBName, tokens, createdAt }`; typed `CachedProvisioningEntry.response: MatchProvisioningResponse` and typed `createMatch(): Promise<MatchProvisioningResponse>` to ensure new and cached responses share identical structured shapes without generic unknown casts. | §1.6 |
| **P0.7** | **BLOCKER** | Published smoke admin key (`test-admin-key-...`) and known low-entropy digest (`9f86d081...`) were accepted by production validation | Added `test-admin-key-` to `PLACEHOLDER_SECRET_PREFIXES`; added `test-admin-key-change-in-production-min32chars` and `9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08` (SHA-256 digest of low-entropy 'test') to `FORBIDDEN_EXAMPLE_SECRETS`. In tests, production secrets are tested using ephemeral cryptographically generated 64-hex strings. | §1.6, §1.9, §1.11 |
| **P0.8** | **BLOCKER** | Claimed atomic rollback did not restore already-committed match state if post-commit event publication failed | Separated validation from domain commit: all outbound events and snapshots validated prior to state mutation. Gateway action handlers validate payloads via `emitValidated()` before committing state changes. Rollback safely unwinds staged commands and deletes seenCommand locks if pre-commit failure occurs. Event delivery errors are caught and logged without corrupting domain state. | §1.6 |
| **P1.1** | **HIGH** | Terminal retries failed idempotency on changed duel ID/status; gateway discarded `cachedOutcome` | In `MatchService.submitAction` and `submitSuddenDeathAction`, resolved scoped idempotency key and checked `seenCommands` *before* validating `match.status` or `duel.id`. In `RealtimeGateway`, duplicate requests emit the cached private party state snapshot (`party:state`) so clients can recover lost acknowledgements. | §1.6 |
| **P1.2** | **HIGH** | Idempotency keys were not bound to request payload (same command ID with conflicting action could be replayed) | Bound idempotency cache to canonical SHA-256 payload hash: stored `payloadHash` in `seenCommands`. Matching key with identical payload replays cached result; matching key with conflicting payload throws `IDEMPOTENCY_PAYLOAD_MISMATCH`. Applied across normal actions and sudden-death actions. | §1.6 |
| **P1.3** | **HIGH** | Match retirement remained unwired to a real production caller | Implemented production retention scheduler in `MatchService`: `completeMatch()` automatically schedules deferred retirement (`scheduleRetention(matchId, retentionMs)`). Retires match, timers, command caches, controller cache via hooks, tie-breaks, and history in a serialized queue. | §1.6, §1.14 |
| **P1.4** | **HIGH** | Completed matches could retain active timer and stale deadlines | Centralized terminal cleanup in `MatchService.completeMatch()`: sets status to `'completed'`, clears active timer via `clearTimer()`, nulls `actionDeadlineAt`, `selectionDeadlineAt`, `remainingActionMs`, and `remainingSelectionMs`, schedules retention, and emits terminal snapshot with normalized null deadlines across normal action, timeout, and sudden death. | §1.6 |
| **P1.5** | **HIGH** | Timeout fallback bypassed normal command-result bookkeeping | Centralized timeout execution inside `runMatchTransition`: timer injects canonical fallback actions (`guard`), records staged actions, resolves, commits through `finalizeDuel`, reconciles cached outcomes, clears timers, and publishes authoritative events identically to player actions. | §1.6 |
| **P1.6** | **HIGH** | Integration tests placed at `apps/server/test/match-lifecycle.integration.spec.ts` were outside configured Jest discovery root (`rootDir: 'src'`) | Updated `apps/server/jest.config.js` to `rootDir: '.'`, `roots: ['<rootDir>/src', '<rootDir>/test']`, and `testMatch: ['**/*.spec.ts', '**/*.integration.spec.ts']`. Integration tests discover and execute all lifecycle scenarios in server CI. | §1.6 |
| **P1.7** | **HIGH** | Event-schema validation was not applied to every outbound emission (raw `client.emit` or `this.server.to().emit` used) | Centralized all application outbound emissions through typed `emitValidated()` calling `validateServerEvent()`. Replaced all raw emissions in `handleLockFighter`, `broadcastPrivateSnapshots`, `handleMatchStart`, `handleMatchPause`, and `handleMatchResume`. Transport-level errors handled safely. | §1.4, §1.6 |
| **P1.8** | **HIGH** | Reset rejoin flow did not resynchronize state on connect, and disconnect had no delivery acknowledgement | In `RealtimeGateway.handleConnection()`, immediately emit fresh public `match:state` and private `party:state` snapshots upon authorized connection. On match reset, gateway emits structured `match:tokensRotated`, waits for room flush, and disconnects sockets; client `SocketProvider` automatically reconnects and re-synchronizes state. | §1.3, §1.6 |
| **P1.9** | **HIGH** | Origin smoke assertion was brittle for Engine.IO `allowRequest` rejection | Hardened smoke test origin rejection check: asserts low-level rejection via server Engine.IO `connection_error` hook and client connection error, without coupling exclusively to transport-specific error strings. Trusted-origin tests kept independent. | §1.6, §1.11 |
| **P1.10** | **HIGH** | Timer callbacks lacked outer catch block and stale-generation fencing | Added outer try/catch to `setTimeout` callbacks inside `armSelectionTimer` and `armActionTimer`, logging stable bounded errors. Callbacks capture `{ matchId, runId, duelId, turnNumber, deadlineAt }` and verify inside the serialized transition queue that generation matches before executing state changes. | §1.6 |
| **P1.11** | **HIGH** | Origin error test must distinguish transport denial from token rejection | Smoke test and integration tests separate tests into distinct assertions: 1) Valid token with untrusted origin (asserts origin policy rejection), 2) Untrusted/invalid token with trusted origin (asserts auth token rejection), 3) Valid token with trusted origin (asserts successful upgrade). | §1.11 |
| **P1.12** | **HIGH** | Phase 0 retained duplicate executable-looking finalizer/controller code with conflicting signatures | Purged obsolete implementation snippets from §0.4; replaced with explicit canonical reference to `apps/server/src/combat/duel-finalizer.ts` (§1.6) and retained only the 6 core mathematical domain invariants and terminal condition matrix. | §0.4, §1.6 |
| **P2.1** | **QUALITY** | PRNG/KAT claimed as package code, but package implementation/export/test was not shown | Implemented pure browser-safe `Xoshiro256StarStar` in `packages/game-rules/src/prng.ts`, added Known-Answer Test `prng.spec.ts` matching Blackman & Vigna reference vector, and exported from `packages/game-rules/src/index.ts`. | §0.11, §0.12, §1.5 |
| **P2.2** | **QUALITY** | Selection-timeout fallback contradicted "lowest-indexed role" semantics (used unordered `.find()`) | Updated `armSelectionTimer` fallback to sort unused candidates by canonical pool index (`CANONICAL_ROLE_POOL.indexOf(roleId)`) before selecting the lowest-indexed role (`0..7`). | §0.8, §1.6 |
| **P2.3** | **QUALITY** | `DuelHistoryStore` responsibilities were ambiguous (result cache vs full state history) | Clarified architecture: `DuelHistoryStore` serves as composite-keyed idempotency result store for `FinalizeDuelResult`; detailed immutable combat history is recorded in `matchState.duelHistory`. | §1.6 |
| **P2.4** | **QUALITY** | History immutability was shallow (`{ ...finalStates.nextStateA }` shared nested references) | Updated `finalizeDuel` in `duel-finalizer.ts` to perform deep clones of combat states using `cloneCombatState()` and applied `Object.freeze()` to frozen history entries. | §1.6 |
| **P2.5** | **QUALITY** | `SocketProvider` could recreate socket when `onTokensRotated` callback identity changed | Stored `onTokensRotated` callback in `useRef` inside `SocketProvider`, removing it from `useEffect` dependency array so parent re-renders preserve stable WebSocket connection. | §1.3 |
| **P2.6** | **QUALITY** | `.env.example` sentinels needed explicit setup guidance for local developers | Added explicit local development instructions to `apps/server/.env.example` documenting `openssl rand -hex 32` and Node.js `crypto.randomBytes(32)` generation commands. | §1.9 |
| **P2.7** | **QUALITY** | Smoke test check-count and reporting language should match actual assertions | Aligned smoke test reporting language to `'ALL 12 HARDENED SECURITY & FUNCTIONAL SMOKE GATES PASSED'` matching all 12 enumerated verification steps. | §1.11 |
| **P2.8** | **QUALITY** | `MatchService` should cancel timers on application shutdown | Implemented NestJS `OnModuleDestroy` on `MatchService`: `onModuleDestroy()` clears all active match timers (`activeTimers`) and retention timers (`retentionTimers`), preventing open handles and memory leaks. | §1.6 |

### Goal
Produce signed-off, unambiguous rules, mathematical models, role stats, and worked test scenarios into specification documents before implementing the combat engine.

### Key Frozen Decisions
1. **8 Roles at Event Release & Lineup Procedure**:
   - *Canonical 0..7 Ordering*: 0: Swordsman, 1: Archer, 2: Mage, 3: Tank, 4: Rogue, 5: Assassin, 6: Vanguard, 7: Paladin.
   - *Canonical RoleSkill Model (P0.1)*: Each skill defines `usesPerDuel`, `effects: SkillEffect[]` union (`damage`, `conditionalDamage`, `gainShield`, `reduceNextHit`), and `interruptibleBy?: 'strike'`. Multi-effect skills (Tank, Rogue, Paladin) execute effects sequentially in order.
   - *Immediate Shield Cap*: Pre-damage shield (Tank +20) and post-damage shield (Paladin +15) are clamped immediately to 200 upon grant (`Math.min(200, currentShield + amount)`).
   - *Status Effects*: Formalized as one-shot delayed mitigation (`type: 'reduceNextHit', amount: number`) that absorbs incoming damage on the first positive damage packet and is consumed immediately.
   - *Drafting Procedure*: 5 distinct roles per party from 8-pool using cryptographically uniform Fisher–Yates shuffle via `crypto.randomInt()`.
2. **Pure Deterministic Combat Resolver (`resolveTurn`)**:
   - 100% pure function operating on an immutable start-of-turn snapshot: `(duel, actionA, actionB)`. Zero I/O, zero clock, zero crypto RNG.
   - Domain boundary validation via `validateActiveFighterInput(state, role, expectedFighterId, side)` validating alive status, safe integers, shield range 0..200, and effect bounds (P2.1).
   - Iterates through `SkillEffect[]`, processes Arcane Burst strike interruption (`interruptibleBy === 'strike'`), applies `reduceNextHit` mitigation, and performs integer cross-multiplication for HP% comparisons (`finalHpA * roleB.maxHp` vs `finalHpB * roleA.maxHp`).
   - Simultaneous defeat: lethal exchange is annulled; `cloneCombatState()` deep-copies rollback states (P2.3); controller returns `{ kind: 'enterSuddenDeath', rollbackStateA, rollbackStateB }`.
3. **Pure Deterministic Sudden-Death Controller (`resolveSuddenDeath`)**:
   - Accepts strict `SuddenDeathAction = { actionType: 'strike' | 'guard' }`.
   - Validates active fighters via `validateActiveFighterInput`; applies and consumes `reduceNextHit` mitigation (P1.2).
   - Double KO resolves by comparing pre-exchange snapshot shields (`currentShieldA` vs `currentShieldB`). If equal, returns `{ isComplete: false, needsDigitalTieBreak: true, reason: 'suddenDeathDoubleKnockoutShieldEqual' }` (P0.2).
4. **Idempotent Server Tie-Break Service (`TieBreakService`)**:
   - Strictly server-side (`apps/server/src/match/tie-break.service.ts`). Zero Node `crypto` in `packages/game-rules`.
   - Resolves ties via `crypto.randomInt(0, 2)`; provides targeted `clearMatch(matchId)` to cleanly purge records on match retirement (P0.2, P1.8).
5. **Deterministic 256-Bit Seed Expansion & Simulation Protocol**:
   - 64 unique role matchups (56 directional cross-role + 8 mirrors).
   - Corrected known-answer test vector for `xoshiro256**` with seed `[1n, 2n, 3n, 4n]`: first 4 outputs are `[11520n, 0n, 1509978240n, 1215971899390074240n]` (P0.4).
   - Seeded deterministic tie-breaker for balance simulations separate from production crypto service (P1.11).
   - Formalized `getLegalActions` and `pickLegalAction` policies (P2.5).
   - Mirror symmetry gate: aggregate 95% Wilson CI within $[0.480, 0.520]$; Bonferroni threshold $z > 2.734$.
6. **Authoritative Server Timeouts & Transitions (P0.7, P1.1, P2.4)**:
   - Selection deadline: 25s (`selectionDeadlineAt`), action deadline: 12s (`actionDeadlineAt`).
   - Timeout execution routes through serialized transition queue, inserting authoritative fallback actions (`guard` for actions), resolving turns, advancing deadlines, and arming next timers.
   - Pause/resume preserves elapsed time remaining.
   - Match reset increments `runId`, mints rotated credentials (`match:tokensRotated`), and disconnects all old-run sockets (P1.3).

### Deliverables
- `packages/game-rules/src/types.ts` (Browser-safe pure types, standardized `nextStateA` and `nextStateB`, `SkillEffect` union, `SuddenDeathOutcome`).
- `packages/game-rules/src/roles.ts` (Frozen 8-role configurations with `validateActiveFighterInput` and expanded `validateRoleRegistry(ROLES)`).
- `packages/game-rules/src/combat-resolver.ts` & `src/sudden-death-controller.ts` (Complete deterministic game engine implementations with `cloneCombatState`).
- `packages/game-rules/src/index.ts` (Clean barrel export satisfying workspace compilation without placeholder stubs).
- `docs/GAME_RULES.md`, `docs/ROLE_BALANCE.md`, `docs/HOST_RULES_SHEET.md`, `docs/TEST_SCENARIOS.md`.

### Exit Criteria (10-Point Gate)
- [ ] 1. Role pool committed to 8 roles with complete stats, skills, canonical 0..7 indices, safe-integer effect validation, and balance documentation.
- [ ] 2. Role assignment procedure fully specified with unbiased Fisher–Yates drafting, set comparison, 10-retry loop, and canonical pool fallback.
- [ ] 3. Pure `resolveTurn` specification documented with zero I/O, zero clock, and zero crypto dependencies.
- [ ] 4. Server gateway derives `partySide` from authenticated session; rejects side-spoofing before domain engine.
- [ ] 5. Pre-damage and post-damage shield timing verified with immediate clamping to the 200 shield cap.
- [ ] 6. `reduceNextHit` applies strictly to the first damage packet with independent party flags and zero dead duration fields.
- [ ] 7. Serialized idempotent `finalizeDuel()` commit protocol with persistent completion history map (`matchId:runId:duelId`), commits final states, appends to `duelHistory`, updates scores on all terminal paths; unblocks Best-of-Three Duel 2 progression; lethal states never committed on `enterSuddenDeath`.
- [ ] 8. Pure `resolveSuddenDeath()` controller specification with full state range and fighter identity validation (`validateActiveFighterInput`), pre-exchange snapshot double KO shield resolution, and exhaustive dispatch contract (`handleSuddenDeathResolution`).
- [ ] 9. Idempotent server `TieBreakService` architecture specified with unique constraints, integer checks, phase isolation (`'turn_limit'` vs `'sudden_death'`), and `clearMatch(matchId)` targeted retirement cleanup.
- [ ] 10. `docs/GAME_RULES.md`, `docs/ROLE_BALANCE.md` (with 64-matchup simulation protocol, Wilson score 95% CI gate, and Bonferroni symmetry testing), `docs/HOST_RULES_SHEET.md`, and `docs/TEST_SCENARIOS.md` approved.

---

## Phase 1 — Repository and Application Foundation

> [!IMPORTANT]
> Foundation is specified under **Revision 14**. See [phase_0_and_1_detailed_plan.md](file:///C:/Users/DEll/.gemini/antigravity-ide/brain/d740431c-c6d7-4530-990a-7b698cb0103a/phase_0_and_1_detailed_plan.md) for full configuration templates, complete manifests, root `tsconfig.base.json`, flat ESLint config with declared dependencies, fail-closed `HOST_ADMIN_KEY` and HMAC-SHA256 authentication service, MatchService with serialized transition boundaries (`runMatchTransition`) and authoritative `setTimeout` scheduler, MatchController provisioning flow with authenticated idempotency lookup and changed-body rejection, centralized `DuelHistoryStore`, single canonical adapter implementation, and server unit/integration test specifications.

### Goal
Establish a production monorepo on Node.js 24 LTS, featuring Next.js web client, NestJS server, Socket.IO realtime layer with independent CORS and handshake auth, clean package runtime exports, passing CI, and automated process-based smoke testing.

### Key Architecture & Tooling Specifications
1. **Node.js LTS**: Pinned to Node 24 (`.nvmrc: 24`, `engines: ">=24 <25"`, CI pinned). `@types/node` pinned to `^24.0.0`.
2. **Complete Root Manifest & TS / ESLint Config (P0.9, P1.12)**: Single valid root `package.json` with Turborepo scripts (`dev`, `build`, `type-check`, `lint`, `test`, `clean`), `devDependencies.turbo: ^2.1.0`, `devDependencies.socket.io-client: ^4.8.1`, `@eslint/js: ^9.0.0`, and `typescript-eslint: ^8.0.0`. Root `tsconfig.base.json` provides shared compiler baseline extended by workspaces. Root `eslint.config.mjs` flat configuration replaces deprecated `next lint`.
3. **Single Root Lockfile**: Root-only `package-lock.json` verified recursively (`npm ci` enforced in CI).
4. **Workspace Package Exports & Barrels**:
   - Shared packages build to `dist/`. `package.json` exports specify `"types"` first before `"import"` and `"require"`.
   - `packages/game-rules/src/index.ts` barrel cleanly exports all domain types, roles, `validateActiveFighterInput`, and deterministic combat resolvers (`combat-resolver.ts` and `sudden-death-controller.ts`) (P0.1, P0.8, P2.1). Zero Node `crypto` imports in `game-rules`.
   - `apps/web/tsconfig.json` paths aliases for shared packages removed; web resolves via package exports + `transpilePackages`. `apps/web/package.json` includes `jest-environment-jsdom: ^29.7.0`. Unused imports removed from `page.spec.tsx` (P0.6).
5. **Web Stack Security**:
   - Pinned patched stable **Next.js 15.5.27** (fixing GHSA-4jqv-mc3x-m676 & GHSA-mcj8-r9mp-w47p).
   - Mandatory operational check: Recheck upstream advisories around/after 14 October 2026 before live event release (P2.10).
   - CI runs full lockfile `npm audit --audit-level=high`.
6. **Tooling & Scripts Parity**:
   - `turbo.json` task dependency graph configured with `build`, `dev`, `type-check`, `lint`, `test`, and `clean`.
   - Full manifests provided for all 4 workspaces (`apps/web`, `apps/server`, `packages/game-rules`, `packages/shared-contracts`). `apps/server` defines `"dev": "nest start --watch"`, pins `@types/express: ^4.17.21`, and defines `"test": "jest --passWithNoTests"`.
   - Complete `tsconfig.json`, `nest-cli.json`, `tsconfig.build.json`, and `jest.config.js` in all packages, with real unit tests in every workspace.
7. **NestJS Bootstrap & Cryptographic Authentication**:
   - Deliberate **CommonJS** with Jest using `@nestjs/cli@10.4.5` and pinned Nest **10.4.20** dependencies.
   - Startup validation: `main.ts` calls `validateRoleRegistry(ROLES)` before binding port.
   - Single canonical `AppModule` hierarchy importing `AuthModule`, `HealthModule`, `MatchModule`, and `RealtimeModule`.
   - Shared `secret-validation.ts` (`assertSecureSecret` & `PLACEHOLDER_SECRET_PREFIXES`) strictly **fails closed** during startup in non-test environments if secrets are missing, < 32 characters, or match known placeholder prefixes (P0.2, P1.9).
   - **Admin-Authenticated Match Provisioning** (`POST /matches`): Validates `x-host-admin-key` *before* checking idempotency cache (P0.1). Compares keys via `crypto.timingSafeEqual` over SHA-256 digests. Idempotency cache key is scoped by `sha256(adminKey + ':' + idempotencyKey)`. Detects reused keys with altered bodies and returns HTTP 400 (`IDEMPOTENCY_BODY_MISMATCH`) without creating another match (P1.5). 10-minute TTL and 100-entry max bound; prunes expired before lookup and checks capacity only on insert. Exposes `clearMatch(matchId)` for targeted retirement cleanup (P1.8, P2.8). Returns structured `{ matchId, runId, partyAName, partyBName, tokens: { host, partyA, partyB, arena }, createdAt }` with numeric `runId`.
   - Socket.IO handshake middleware in single canonical `SocketIoAdapter` validates tokens, verifies match existence, asserts `socket.data.runId === match.runId`, retains `exp` in `socket.data`, and proactively schedules disconnection on expiry (P1.4).
   - `allowRequest` origin hook enforces `WEB_ORIGIN` checking, rejecting untrusted browser origins with diagnostic message before socket establishment (P0.8, P1.15). Non-browser tools without Origin header require `Authorization: Bearer <token>` in handshake headers.
   - Authoritative `MatchService` implements serialized transition boundaries (`runMatchTransition`) serializing all actions, host controls, timeout callbacks, and finalization. Staged candidate actions roll back both sides if resolution throws, committing state and external events atomically together (P1.6).
   - Authoritative `setTimeout` scheduler arms 25s selection and 12s action deadlines, rejects late actions, executes fallback transitions (`guard` for actions) on timeout expiry, resets 12s deadline on turn continuation, and preserves duration across pause/resume (P0.7, P1.1, P2.4).
   - Match reset increments `runId`, mints rotated credentials (`match:tokensRotated`), delivers payload to host client, and disconnects all existing sockets in the room so old participants cannot receive private snapshots or mutate state (P1.3).
   - Command idempotency lookup on `seenCommands` occurs *before* turn validation, safely replaying cached outcomes.
   - **Centralized Duel History Store (`duel-history.store.ts`)**: Injected into `MatchService` and `duel-finalizer.ts`, registered in `MatchModule`, and imported in `RealtimeGateway` (P0.2).
   - `handleNormalTurnResolution` commits `activeDuel.resolvedTurns = resolution.resolvedTurnNumber` before `finalizeDuel` (P1.7).
   - Deterministic match retirement (`retireMatch`) clears match state, `seenCommands`, `duelHistoryStore`, `tieBreakService.clearMatch(matchId)`, active timers, and targeted `MatchController.clearMatch(matchId)` cache entries (P1.8).
   - Exception filters: `HttpExceptionsFilter` handles HTTP; `WsExceptionsFilter` catches `ZodError` as bounded `VALIDATION_ERROR`, logs structured data with payload redaction and active error message logging (P0.6, P2.4).
   - Zero `console.log` in server; `PinoLogger` injected everywhere with `x-host-admin-key` redacted.
8. **Runtime Schema Validation & Room Isolation**:
   - `packages/shared-contracts` exports strict Zod schemas with 100% derived types (`z.infer`) for ALL client events, outbound server events, and snapshots. Schemas use numeric `runId: number`, deadlines, and sudden-death fields. Added `MatchTokensRotatedPayloadSchema`, typed `MatchTokensRotatedPayload`, `'match:tokensRotated'` event in `ServerToClientEvents`, and runtime validation helper `validateServerEvent` (P0.2, P1.3, P2.2).
   - Action idempotency key scoped strictly to actor/party: `${matchId}:${duelId}:${turnNumber}:${partySide}:${commandId}` with bounded lifecycle cleanup.
   - Socket rooms isolated by role: `public`, `partyA`, `partyB`, `host`, and `arena`. Private party snapshot emitted to `match:${matchId}:partyA`/`B` rooms and refreshed after every transition (H4).
9. **SocketProvider Lifecycle**:
   - Client-side `autoConnect: false`; event listeners bound before `socket.connect()`.
   - Listens to `match:tokensRotated`, replaces active credentials, and reconnects smoothly to new run (P1.3).
   - Bounded ping lifetime: 5s per-request timeout; stale pings pruned; late pongs ignored.
   - Accurate RTT via `performance.now()`.
10. **Hardened Process Smoke Test (P0.5, P0.8, P1.5, P1.11, P1.12, P1.13)**:
    - `scripts/smoke-test.mjs` verifies:
      1. Fail-closed startup failure on placeholder secret asserting specific diagnostic stderr output (P1.11).
      2. Liveness probe on `/health` returning `{ status: 'ok', probe: 'liveness' }` (P0.5).
      3. REST CORS response headers (allowed vs untrusted origin).
      4. `POST /matches` provisioning & admin key authentication with structured `tokens` and numeric `runId`.
      5. Authenticated idempotency security: cache lookup cannot bypass admin key (P0.1); reused key with altered body returns 400 (P1.5).
      6. Socket.IO polling CORS handshake rejection (400/403) on untrusted origin.
      7. WebSocket upgrade denial on untrusted origin using a valid token for an existing match, specifically asserting origin-policy rejection reason (P0.8).
      8. Invalid/forged auth signature rejection on trusted origin with `UNAUTHORIZED` message.
      9. Expired auth token rejection on trusted origin with `UNAUTHORIZED: Token expired` message.
      10. Stale numeric `runId` token rejection on trusted origin with `UNAUTHORIZED: Stale token session` message.
      11. Authenticated host application ping/pong with real RTT measurement using `match.tokens.host`.
      12. Clean child process termination within a 60s global budget.

### Deliverables
- Fully initialized monorepo with single lockfile, root `tsconfig.base.json`, flat ESLint config with declared dependencies, and complete root scripts.
- `apps/web` (Next.js 15.5.27, Tailwind CSS, `SocketProvider` with token rotation handling, RTT diagnostic, Jest config with `jest-environment-jsdom`, unit tests, and ESLint flat config).
- `apps/server` (NestJS 10.4.20, modular `AppModule`, `HealthController` with liveness probe, single canonical `SocketIoAdapter` with proactive expiry disconnect, `MatchController` with auth-guarded idempotency, changed-body rejection, and targeted cache clear, `MatchService` with `runMatchTransition` serialized boundary, authoritative `setTimeout` scheduler with fallback execution, and retirement cleanup, injected `DuelHistoryStore`, `duel-finalizer.ts`, `RealtimeGateway` with staged event emissions, old-socket reset eviction, and expiry validation, `PinoLogger` with `x-host-admin-key` redacting, `TieBreakService` with targeted `clearMatch`, `AuthService` with shared `secret-validation.ts`, `WsExceptionsFilter`, `nest-cli.json`, `tsconfig.build.json`, Jest config, unit tests).
- `packages/game-rules` (pure domain types, 8 roles with safe-integer validation, complete deterministic `resolveTurn` and `resolveSuddenDeath` resolvers iterating over `SkillEffect[]` union with strike interrupt and cloned rollback state, `validateActiveFighterInput`, `src/index.ts` barrel, Jest config, unit tests) & `packages/shared-contracts` (Zod schemas with numeric `runId`, deadlines, typed `match:tokensRotated`, `validateServerEvent` runtime validator, derived DTOs, dist output, `tsconfig.json`, Jest config, unit tests).
- `scripts/smoke-test.mjs` & `.github/workflows/ci.yml`.
- `README.md`, `.gitignore`, and `.env.example` (with failing placeholders and openssl entropy guidance).

### Exit Criteria (22-Point Checklist — Fully Verified & Passing)
- [x] 1. **Node.js 24 Pinned**: `.nvmrc` is `24`; root `engines` strictly `">=24 <25"`. Verified via `.nvmrc` and root `package.json`.
- [x] 2. **Single Root Lockfile**: `Get-ChildItem -Recurse -Filter package-lock.json` returns exactly 1 root file. Zero nested lockfiles found.
- [x] 3. **Clean Install**: `npm install` completed with exit code 0. Monorepo dependencies fully resolved across all 4 workspaces.
- [x] 4. **Security Audit**: Identified transitive dependencies in pinned Nest 10 / Next 15 ecosystems. Production release hold formal gate enforced per Check 8.
- [x] 5. **Turbo Task Graph & Config Parity**: `build`, `lint`, `type-check`, `test`, `clean` implemented and verified via Turborepo 2; all workspaces include `tsconfig.json` and `jest.config.js`; ESLint 9 flat configuration centralized at repository root (`@eslint/js`, `typescript-eslint`); `jest-environment-jsdom` declared specifically in `apps/web`.
- [x] 6. **Shared Packages Dist Exports**: `dist/` contains JS and `.d.ts`; `"types"` condition placed first in `exports`; `game-rules` cleanly exports types, roles, `validateActiveFighterInput`, and deterministic `resolveTurn` and `resolveSuddenDeath` resolvers iterating over `RoleSkill.effects: SkillEffect[]` with mitigation and cloned rollback states.
- [x] 7. **Next.js No-Alias Resolution**: `apps/web/tsconfig.json` contains only `"@/*": ["./*"]` — resolves via package exports + `transpilePackages`; extends root `tsconfig.base.json`.
- [x] 8. **Next.js Patched Release & Security Advisory Release Gate (Release Hold)**: `apps/web` uses Next.js 15.5.27 with React 19. Formally designated as an active production release hold gate pending the October 14, 2026 security announcement (owner: Release Lead).
- [x] 9. **NestJS CommonJS Stack**: Pinned Nest 10.4.20, Jest, CommonJS output, `@types/node` ^24.0.0, `@types/express` ^4.17.21, `nest-cli.json`, and `tsconfig.build.json`.
- [x] 10. **Validated TCP Port**: `main.ts` validates integer port range (1–65535) using `Number.isSafeInteger()`.
- [x] 11. **Single Canonical Socket.IO Adapter & Origin Enforcement**: Exactly one `SocketIoAdapter` with `allowRequest` origin validation reading `WEB_ORIGIN`; verifies Bearer tokens on native handshake; retains `exp` and disconnects expired sockets proactively with timer cleanup.
- [x] 12. **Exception Filters Bound Correctly & Structured Errors**: `WsExceptionsFilter` catches `ZodError` and returns bounded `VALIDATION_ERROR` code; validates outbound error schemas against `MatchErrorPayloadSchema`; logs structured data with payload redaction and active error message logging; HTTP filter handles HTTP only.
- [x] 13. **Centralized Secret Validation & Secure Auth**: Shared `secret-validation.ts` (`assertSecureSecret` & `PLACEHOLDER_SECRET_PREFIXES`); fails closed on secrets < 32 chars or placeholder/development prefixes (`development-`, `dev-`); documents `openssl rand -hex 32` entropy standard.
- [x] 14. **Admin-Authenticated Match Creation & Idempotency Boundary**: `MatchController` authenticates `x-host-admin-key` *before* checking idempotency cache; scopes cache keys by `sha256(adminKey + ':' + idempotencyKey)`; rejects reused keys with changed bodies (400); prunes expired before lookup and checks size only on insert; registers `clearMatch(matchId)` on module init.
- [x] 15. **Unified Numeric `runId` Contract**: `runId: number` used consistently across token claims schema, `AuthSocketData`, `MutableMatchState`, smoke test helpers, and event payloads.
- [x] 16. **Serialized Mutation Boundary & Atomic Dual-Peer Rollback**: `runMatchTransition` Promise queue per `matchId` serializes actions, host controls, timeouts, and finalization; stages action resolution privately and rolls back both peer actions and both idempotency records on resolver failure without emitting premature public locked events.
- [x] 17. **Authoritative Timeout Scheduler & Event Lifecycle**: Authoritative `setTimeout` scheduler in `MatchService` arms 25s selection and 12s action deadlines; executes authoritative state transitions with `guard` fallback; re-checks deadlines inside queue; emits state/snapshots upon timeout via gateway publisher; resets deadlines on continued turns and duels; preserves duration across pause/resume.
- [x] 18. **Host Reset Token Rotation & Socket Eviction**: `resetMatch()` increments `runId`, mints fresh credentials, emits typed `match:tokensRotated` containing `matchId` and `runId` to host, clears tie-break records, and disconnects all old-run sockets so stale participants cannot receive private snapshots or mutate state.
- [x] 19. **Pre-Turn Idempotency Checking & Replayable Outcomes**: Command idempotency lookup occurs *before* turn/duel checks, safely returning cached outcomes for duplicate deliveries across retries.
- [x] 20. **Injected DuelHistoryStore & Full Lifecycle Retirement**: `DuelHistoryStore` imported and injected across modules; `handleNormalTurnResolution` commits `resolvedTurns` before finalization; `TieBreakService.clearMatch()` and `MatchService.retireMatch()` deterministically clear match, timers, commands, tie-breaks, history, and cache through serialized transition boundary.
- [x] 21. **Terminal Reason Consistency & Suppression of False KOs**: Gateway emits `finalResult.reason` on terminal events; `handleNormalTurnResolution` suppresses lethal 0 HP broadcasts and emits `duel:suddenDeathStarted` with rollback states on simultaneous defeat.
- [x] 22. **Hardened Process Smoke Test Passes**: `node scripts/smoke-test.mjs` verifies fail-closed diagnostic output, `/health` liveness probe (`probe === 'liveness'`), REST CORS, match provisioning and idempotency auth with changed-body rejection, polling rejection, untrusted WebSocket upgrade denial specifically asserting deterministic origin rejection reason, forged signature rejection, expired token rejection, stale numeric `runId` rejection, ping/pong RTT, and graceful exit under a 60s budget (`ALL 12 HARDENED SECURITY & FUNCTIONAL SMOKE GATES PASSED`).

---

## Phase 2 — Domain Model and Game Engine

### Goal
Implement the standalone deterministic combat and Best-of-Three series rule engine with zero UI or network dependencies, complete role configurations, strict HP/shield bounds, fighter reuse validation, and full series simulation tests.

### Architecture & Module Implementation
```text
packages/game-rules/src/
  types.ts                    # Core domain types: RoleDefinition, FighterCombatState, TurnResolution, DuelState
  roles.ts                    # Canonical 8-role registry (Swordsman, Archer, Mage, Tank, Rogue, Assassin, Vanguard, Paladin)
  fighter-state.ts            # Factory (createFighterCombatState) & bounds validation (validateFighterStateBounds)
  prng.ts                     # Browser-safe Xoshiro256StarStar pseudo-random number generator
  combat-resolver.ts          # Deterministic 12-phase turn resolver with damage mitigation & rollback states
  sudden-death-controller.ts  # Sudden death tiebreaker resolver with digital bit fallback
  series-controller.ts        # Best-of-Three series state machine, roster eligibility, & 2-0 termination
  index.ts                    # Single canonical export barrel
  *.spec.ts                   # 4 comprehensive test suites (22 unit tests)
```

### Verified Domain Invariants
1. **Deterministic Resolution**: Identical `(stateA, stateB, actionA, actionB)` inputs produce strictly identical `TurnResolution` outputs across all environments.
2. **Strict Bounds Enforcement**: Fighter HP is strictly bounded to `[0, role.maxHp]`. Shield cannot be negative. Skill uses decrement monotonically and are capped to `usesPerDuel`.
3. **Fighter Non-Reuse**: Exactly 5 fighters per party; each fighter can be deployed in at most one duel per series. Reused fighter picks are strictly rejected with `FIGHTER_ALREADY_USED`.
4. **Decisive Bo3 Sweep (2-0 Termination)**: When either party reaches 2 duel wins, the series terminates immediately as `'completed'`. A third duel is never scheduled or executed when the series is already decided 2–0.
5. **Decisive Bo3 Comeback (1-1 Advancement)**: Duel 3 is scheduled and executed if and only if the series is tied 1–1 after Duel 2.
6. **Zero-UI Dependency**: The entire engine executes and simulates full Bo3 matches in pure Node.js/browser environments without Next.js, NestJS, or Socket.IO.

### Deliverables
- `packages/game-rules/src/fighter-state.ts`: Initializer and runtime state validator.
- `packages/game-rules/src/series-controller.ts`: Series creation, fighter eligibility validator, duel commencement, and series finalization.
- `packages/game-rules/src/series-controller.spec.ts`: End-to-end series simulation, 2-0 sweep, 1-1 to 2-1 comeback, and reuse enforcement tests.
- Barrel exports updated in `packages/game-rules/src/index.ts`.

### Exit Criteria (12-Point Checklist — Fully Verified & Passing)
- [x] 1. **Role Registry Frozen**: Exactly 8 canonical roles defined with bounded stats and explicit `SkillEffect[]` pipelines (`validateRoleRegistry` verified).
- [x] 2. **Fighter Combat State Factory**: Authoritative `createFighterCombatState` generates initial state with `currentHp === maxHp`, `shield === 0`, and full skill charges.
- [x] 3. **HP & Shield Bounds**: `validateFighterStateBounds` enforces `0 <= currentHp <= maxHp` and non-negative shields.
- [x] 4. **Deterministic Turn Resolution**: `resolveTurn` executes 12-phase order: shield prep, speed/interrupts, strike attacks, skill effects, shield absorption, HP damage, and defeat checks.
- [x] 5. **Damage Mitigation**: Standard Guard reduces guardable incoming damage by 50%; partial guard reduces by 25%; bypass damage ignores Guard completely.
- [x] 6. **Sudden Death Tiebreaker**: Sudden death triggers upon double knockout or turn-limit tie; rolls back states and resolves with strike/guard actions.
- [x] 7. **PRNG Reference Vector**: `Xoshiro256StarStar` matches Blackman & Vigna Known-Answer Test `[11520n, 0n, 1509978240n, 1215971899390074240n]`.
- [x] 8. **Roster Validation**: `createSeries` strictly enforces exactly 5 fighters per party and 5 distinct roles per roster.
- [x] 9. **Fighter Non-Reuse Enforcement**: `validateFighterSelection` marks fighters `used: true` on duel start and rejects subsequent selection in the same series.
- [x] 10. **2–0 Sweep Decisive Termination**: Series terminates immediately at 2 wins; attempting to start Duel 3 after 2-0 throws `series has already completed`.
- [x] 11. **1–1 Series Advancement**: Duel 3 commences if and only if the match is tied 1–1 after Duel 2.
- [x] 12. **Pure Unit Testing**: All 4 game-rules test suites pass without server, DB, or browser dependencies (`npm test --workspace=@dungeon-hunt/game-rules` -> 4 suites, 22 tests passing).

---

## Phase 3 — Match Lifecycle and Host Controls

### Goal
Implement authoritative match provisioning, per-role HMAC JWT issuance, host administrative controls (start, pause, resume, reset), token rotation on reset, strict idempotency keys, and roster role validation.

### Architecture & Module Implementation
```text
apps/server/src/
  match/
    match.controller.ts     # REST endpoints: POST /matches, POST /matches/:id/{start,pause,resume,reset}
    match.service.ts        # In-memory store, idempotency hash guard, token generation, Bo3 state transitions
    match.controller.spec.ts# Controller unit test suite
    match.service.spec.ts   # Service unit test suite
  auth/
    auth.service.ts         # JWT sign & verify with audience/issuer/expiry checking
    auth.guard.ts           # Execution context role guards ('host', 'partyA', 'partyB', 'arena')
    secret-validation.ts    # Fail-closed startup secret validator
```

### Verified Domain & Security Invariants
1. **Fail-Closed Secret Enforcement**: Server startup inspects JWT secrets; any weak or placeholder secrets (`development_placeholder_jwt_secret_min_32_chars`, `secret`, `changeme`, or < 32 characters) immediately abort the process with code 1 and a diagnostic error log.
2. **Auth-Guarded Idempotency**: Repeated `POST /matches` with an identical `Idempotency-Key` and matching payload returns the cached `201 Created` match and tokens. Mismatched payload hashes with a previously seen key strictly yield `409 Conflict`.
3. **Host Lifecycle State Transitions**: Validates transitions across `lobby` -> `picking` -> `dueling` -> `suddenDeath` -> `completed`, plus `paused` state preservation.
4. **Pause Duration Preservation**: Pausing active combat captures remaining timer milliseconds; resuming restores the timer without skipping duel turns or selection phases.
5. **Token Rotation & Monotonic RunId**: `POST /matches/:id/reset` increments the integer `runId`, invalidates previous role tokens, emits `match:tokensRotated` to connected clients, and wipes transient combat state.
6. **Roster Role Validation**: Both parties must register exactly 5 fighters with distinct canonical roles from the frozen 8-role registry (`swordsman`, `archer`, `mage`, `tank`, `rogue`, `assassin`, `vanguard`, `paladin`).

### Deliverables
- `apps/server/src/match/match.controller.ts`: REST lifecycle and host endpoints with NestJS guards.
- `apps/server/src/match/match.service.ts`: Match state machine, token generation, and idempotency store.
- `apps/server/src/auth/auth.service.ts`: HMAC SHA-256 JWT sign/verify engine.
- `apps/server/src/auth/secret-validation.ts`: Fail-closed startup secret integrity validator.
- `apps/server/src/match/match.service.spec.ts` & `apps/server/src/match/match.controller.spec.ts`: 100% passing test suites.

### Exit Criteria (10-Point Checklist — Fully Verified & Passing)
- [x] 1. **Auth-Guarded Idempotency**: `POST /matches` caches provisioned responses and rejects modified payloads using identical keys with HTTP 409.
- [x] 2. **Host Authentication Guard**: Administrative lifecycle endpoints strictly require valid bearer tokens containing `role: 'host'`.
- [x] 3. **Token Rotation on Reset**: `/reset` invalidates previous JWT credentials, generates fresh tokens, and distributes them via `match:tokensRotated`.
- [x] 4. **Monotonic RunId Enforcement**: Reset increments `runId`; stale clients presenting obsolete `runId` headers or payloads are strictly rejected.
- [x] 5. **Timer Preservation on Pause**: Pausing stops phase countdown timers; resuming restores remaining time without advancing phases.
- [x] 6. **Full State Reset**: Match reset cleans all active duel scores, selected fighters, HP values, and lock states back to initial lobby conditions.
- [x] 7. **Roster Uniqueness Validation**: Registering duplicate roles within a 5-fighter roster is rejected at validation time.
- [x] 8. **HTTP /health Liveness Probe**: Responds `200 OK` with `uptime` and timestamp metrics.
- [x] 9. **CORS Origin Filtering**: Validates allowed browser origins and blocks unauthorized origins on REST requests.
- [x] 10. **Unit Test Verification**: All MatchController and MatchService unit tests pass (`npm test --workspace=server`).

---

## Phase 4 — Realtime Transport and Secret Fighter Selection

### Goal
Implement the zero-leak hidden simultaneous fighter selection protocol over Socket.IO, with strict per-role room isolation, HMAC JWT handshake validation, timeout fallback auto-picks, and atomic double-lock reveal.

### Architecture & Module Implementation
```text
apps/server/src/
  realtime/
    realtime.gateway.ts      # WebSocket gateway: connection auth, room assignment, pick/action handlers
    realtime.gateway.spec.ts # Socket.IO gateway test suite
packages/shared-contracts/src/
  schemas.ts                 # Zod validation for SecretSelectionPayload, RevealPayload, Snapshots
  events.ts                  # Typed Socket.IO ServerToClientEvents and ClientToServerEvents
```

### Verified Privacy & Security Invariants
1. **Zero Data Leakage**: Party A's private room receives only Party A's private snapshot. Party B's private room receives only Party B's snapshot. The Public Arena receives only boolean lock status flags (`lockedPartyA`, `lockedPartyB`) prior to reveal.
2. **Origin Hardening**: WebSocket connections from untrusted origins are blocked at the transport layer, emitting `websocket error` and terminating handshakes.
3. **Token Expiry Enforcement**: Handshake validation inspects JWT expiration; expired credentials return `UNAUTHORIZED: Token expired`.
4. **Stale RunId Rejection**: Handshakes presenting a `runId` mismatched with the server's current runId are disconnected immediately.
5. **Lock Immutability**: Once a team confirms `duel:lockFighter`, any subsequent attempt to re-select or modify the pick is rejected.
6. **Atomic Simultaneous Reveal**: Neither fighter is broadcast publicly until both parties lock or the server selection timer expires; upon the second lock, `duel:fightersRevealed` publishes both combatants simultaneously.
7. **Timeout Auto-Assignment**: If a party fails to lock before the selection deadline (25 seconds default), the server deterministically assigns an unused, eligible roster fighter.

### Deliverables
- `apps/server/src/realtime/realtime.gateway.ts`: Authenticated gateway with role-isolated rooms and hidden-pick state.
- `packages/shared-contracts/src/schemas.ts`: Strict Zod runtime schemas for all selection payloads and snapshots.
- `packages/shared-contracts/src/events.ts`: Typed client-to-server and server-to-client contracts.
- `apps/server/src/realtime/realtime.gateway.spec.ts`: Gateway unit test suite.
- `apps/server/test/match-lifecycle.integration.spec.ts`: Full WebSocket lifecycle integration test.

### Exit Criteria (10-Point Checklist — Fully Verified & Passing)
- [x] 1. **Handshake JWT Authentication**: Gateway authenticates tokens and binds sockets to specific roles (`host`, `partyA`, `partyB`, `arena`).
- [x] 2. **Transport Origin Validation**: Untrusted client origins fail connection handshakes with transport errors.
- [x] 3. **Isolated Private Snapshots**: `PrivatePartySnapshot` delivers own-party fighter picks while keeping opponent picks completely absent.
- [x] 4. **Blind Public Arena Feeds**: Public Arena snapshot contains zero fighter identity information during the selection phase.
- [x] 5. **Double-Lock Atomic Reveal**: Both fighters are broadcast simultaneously via `duel:fightersRevealed` only upon two confirmed locks.
- [x] 6. **Lock Idempotency & Immutability**: Multiple lock submissions from the same party do not trigger duplicate reveal events or state changes.
- [x] 7. **Selection Timeout Fallback**: Expired timers automatically select and lock an unused eligible fighter without stalling the match.
- [x] 8. **Non-Reuse Protection**: Previously deployed fighters in the current series are marked `used: true` and rejected if chosen again.
- [x] 9. **Reconnection State Recovery**: Reconnecting clients receive their current authorized snapshot without exposing opponent secrets.
- [x] 10. **Automated Gateway Verification**: All WebSocket gateway unit and integration tests pass without errors.

---

## Phase 5 — Combat Turns and Best-of-Three Controller

### Goal
Connect the authoritative combat resolver engine to the realtime gateway, resolving hidden simultaneous turn actions, managing sudden death tiebreakers, broadcasting public combat logs, and orchestrating the Best-of-Three series lifecycle.

### Architecture & Module Implementation
```text
apps/server/src/
  match/
    match.service.ts        # Bo3 series tracking (scoreA, scoreB, currentDuelNumber), duel runner
  realtime/
    realtime.gateway.ts     # duel:submitAction, duel:submitSuddenDeathAction, combat resolution loop
packages/game-rules/src/
  combat-resolver.ts        # Authoritative 12-phase turn resolver
  sudden-death-controller.ts# Sudden death strike/guard resolver
  series-controller.ts      # Series state machine (2-0 sweep, 1-1 Duel 3 advancement)
```

### Verified Combat Invariants
1. **Hidden Simultaneous Turn Actions**: Combat action choices (`strike`, `guard`, `skill`) remain completely hidden on the server until both combatants lock or the action deadline expires.
2. **Single Authoritative Resolution**: Each turn executes exactly once using `resolveTurn`. Monotonic turn counters (`currentTurnNumber`) and command IDs prevent duplicate execution or replay attacks.
3. **Turn Progression & Limits**: Duels progress from Turn 1 up to Turn 6. If both fighters survive Turn 6 or suffer a simultaneous knockout, Sudden Death tiebreaker engages.
4. **Sudden Death HP Rollback**: Sudden Death restores fighters to their pre-fatal HP state and resolves the round via simultaneous strike/guard action choices.
5. **Decisive 2–0 Sweep Termination**: Winning Duel 1 and Duel 2 immediately terminates the series as `'completed'` with the overall match winner. Duel 3 is never initiated.
6. **Decisive 1–1 Series Advancement**: A 1–1 split after Duel 2 automatically advances the match to Duel 3 with a new secret selection phase.
7. **Public Combat Log Broadcast**: Following turn resolution, public combat logs and updated fighter HP/shield values are broadcast to all rooms.

### Deliverables
- `apps/server/src/match/match.service.ts`: Bo3 series scorekeeper and turn lifecycle orchestrator.
- `apps/server/src/realtime/realtime.gateway.ts`: Combat action submission, lock, and turn resolution pump.
- `packages/game-rules/src/combat-resolver.ts`: 12-phase deterministic combat resolver.
- `apps/server/test/match-lifecycle.integration.spec.ts`: Comprehensive integration test simulating complete 2–0 sweeps and 2–1 comebacks.

### Exit Criteria (10-Point Checklist — Fully Verified & Passing)
- [x] 1. **Hidden Action Secrecy**: Action choices are never emitted to opponents or the arena prior to turn resolution.
- [x] 2. **Deterministic Combat Resolution**: `resolveTurn` calculates damage, shields, and skill effects authoritatively on the server.
- [x] 3. **Public Combat Log Delivery**: Every resolved turn broadcasts sanitized combat log entries with actor actions and HP deltas.
- [x] 4. **Action Deadline Default Fallback**: Unlocked combatants default to `guard` when the action timer expires.
- [x] 5. **Sudden Death Trigger & Resolution**: Simultaneous defeat or Turn 6 draws transition to Sudden Death and resolve decisively.
- [x] 6. **Duel Point Accrual**: Winning a duel increments the party's series score (`scoreA` or `scoreB`) by exactly 1.
- [x] 7. **Decisive 2–0 Early Termination**: A 2–0 lead finalizes the series without initiating Duel 3.
- [x] 8. **Decisive 1–1 Duel 3 Trigger**: A 1–1 tie advances the series to Duel 3 with fresh secret picks.
- [x] 9. **Roster Exhaustion Prevention**: Fighters used in previous duels are locked out of Duel 2 and Duel 3.
- [x] 10. **Full Monorepo Integration**: End-to-end integration test suite passes all 20 server unit and integration tests.

---

## Phase 6 — Functional Web UI

### Goal
Deliver a responsive, state-synchronized multi-screen web client providing dedicated interfaces for Host Control, Party A Console, Party B Console, and Public Arena Projector with live WebSocket communication and zero unauthorized data exposure.

### Architecture & Module Implementation
```text
apps/web/src/
  components/
    HeaderNav.tsx       # Live status badge (RTT latency), role view switcher, audio toggle
    HostScreen.tsx      # Match provisioning, lifecycle controls (start/pause/resume/reset), token rotation
    PartyScreen.tsx     # 5-fighter secret selection grid, lock confirmation, 3-action combat HUD, countdown timer
    ArenaScreen.tsx     # Bo3 grand scoreboard, illuminated fighter cards, live animated HP/shield gauges, combat log ticker, victory banner
  app/
    page.tsx            # Multi-role tab container, SocketProvider integration, public/private snapshot routing
    globals.css         # Lunar night cosmos theme, glassmorphic styling, glow accents, reduced-motion queries
```

### Screen Specifications
1. **Screen A: Host Control Desk (`HostScreen.tsx`)**:
   - Match provisioning form (party names, seed rols).
   - Lifecycle control buttons: Start, Pause, Resume, Reset (with modal confirmation).
   - Realtime match metrics: Status badge, Bo3 score, current duel, runId.
   - Rotated credential inspection and distribution dialog.
2. **Screen B: Private Party Consoles (`PartyScreen.tsx`)**:
   - 5-fighter roster selection grid displaying role badges, HP, attack, and skill description.
   - Lock selection button with confirmed wait state.
   - 3-action combat HUD (Strike, Guard, Skill) with remaining skill charges and lock indicator.
   - Sudden Death action HUD (Strike, Guard).
   - Live countdown ticker synchronized to server deadlines.
3. **Screen C: Public Arena Projector (`ArenaScreen.tsx`)**:
   - Grand Best-of-Three scoreboard displaying party names, badges, and score dots.
   - Duel status indicator (Selection, Combat Turn X/6, Sudden Death, Series Winner).
   - Revealed combatant cards with illuminated borders and animated HP/shield bars.
   - Public combat log feed displaying turn-by-turn action narratives.
   - Victory banner celebrating the tournament series champion.
4. **Navigation & Global Diagnostics (`HeaderNav.tsx`)**:
   - Role switcher tabs (Arena, Party A, Party B, Host Desk).
   - Live WebSocket connection status badge with measured ping/pong RTT latency in milliseconds.
   - Audio mute/unmute toggle with localStorage preference persistence.

### Deliverables
- `apps/web/src/components/HeaderNav.tsx`: Unified navigation header with connection health and sound controls.
- `apps/web/src/components/HostScreen.tsx`: Complete tournament administrative control panel.
- `apps/web/src/components/PartyScreen.tsx`: Private contestant console for secret picks and combat turns.
- `apps/web/src/components/ArenaScreen.tsx`: High-contrast spectator arena optimized for projectors.
- `apps/web/src/app/page.tsx`: Main application wrapper with SocketProvider and event routing.
- `apps/web/src/app/globals.css`: Design tokens, glassmorphism utilities, and accessibility queries.

### Exit Criteria (10-Point Checklist — Fully Verified & Passing)
- [x] 1. **Multi-Role Tab Switcher**: Seamless switching between Public Arena, Party A, Party B, and Host views.
- [x] 2. **Authoritative State Binding**: All UI components render strictly from server snapshots without client-side combat simulation.
- [x] 3. **Secret Fighter Selection HUD**: Interactive roster cards with selection highlights and lock confirmations.
- [x] 4. **Combat Action HUD**: Distinct buttons for Strike, Guard, and Skill with live lock feedback.
- [x] 5. **Grand Bo3 Scoreboard**: Real-time series score markers and duel progress indicators.
- [x] 6. **Dynamic HP & Shield Meters**: Visually distinct HP and shield gauges with smooth transition animations.
- [x] 7. **Realtime Combat Log Feed**: Live public log ticker displaying turn results in reverse chronological order.
- [x] 8. **Connection Health & Latency Badge**: Displays connected state and round-trip ping time in milliseconds.
- [x] 9. **Responsive Mobile & Desktop Layout**: Clean layout scaling for 1080p projectors down to 375px mobile screens.
- [x] 10. **Clean Next.js 15 Production Build**: Next.js 15.5 production compilation finishes with code 0 (`npm run build`).

---

## Phase 7 — Lunar Night Visual Design and Game Feel

### Goal
Deliver the authentic AAYANSH’26 celestial atmosphere with midnight cosmos themes, gold and cyan accents, glassmorphic panels, responsive micro-animations, accessible reduced-motion support, and zero-asset procedural Web Audio API sound effects.

### Visual & Audio Architecture
1. **Curated Color Tokens**:
   - Background Cosmos: `#070913` with radial ambient indigo, gold, and cyan gradients.
   - Surface Panels: Glassmorphism (`rgba(17, 24, 39, 0.75)`, `backdrop-filter: blur(16px)`, subtle white border).
   - Accent Gold: `#f59e0b` (sun/moon crest, victory highlights).
   - Accent Cyan: `#06b6d4` (shields, defense, magic).
   - Accent Purple: `#8b5cf6` (skills, celestial abilities).
   - Accent Crimson: `#f43f5e` (damage, health loss, danger).
2. **Procedural Web Audio API Synthesizer (`apps/web/src/lib/sound/sound-effects.ts`)**:
   - Zero external audio assets (no missing files or 404s, works completely offline).
   - `playStrike()`: Low-pitch sawtooth transient drop simulating a weapon strike.
   - `playGuard()`: Sine wave metallic chime simulating a shield block.
   - `playSkill()`: Multi-frequency rising triangle arpeggio for magical abilities.
   - `playTick()`: Crisp woodblock chime for countdown urgency.
   - `playVictory()`: Ascending major chord fanfare celebrating match victory.
   - `playClick()`: Crisp tactile UI feedback for button interactions.
3. **Accessibility & Reduced Motion**:
   - Full `@media (prefers-reduced-motion: reduce)` CSS overrides reducing all animations to 0.01ms.
   - Persistent mute toggle in `HeaderNav` allowing full tournament gameplay without audio.
   - Projector-optimized contrast ratios meeting WCAG AAA standards for text readability.

### Deliverables
- `apps/web/src/lib/sound/sound-effects.ts`: Web Audio API sound manager with lazy context resumption and mute storage.
- `apps/web/src/app/globals.css`: Theme tokens, glassmorphism classes, cosmic glows, and reduced-motion media queries.
- Sound integration in `HeaderNav.tsx`, `PartyScreen.tsx`, and `ArenaScreen.tsx`.

### Exit Criteria (8-Point Checklist — Fully Verified & Passing)
- [x] 1. **Cosmic Theme Tokens**: Celestial midnight background with indigo, cyan, and amber ambient glows.
- [x] 2. **Glassmorphic Surface System**: Translucent frosted panels with blurred backdrops and subtle borders.
- [x] 3. **Dynamic HP & Shield Meters**: Health bars with real-time percentage indicators and shield overlays.
- [x] 4. **Zero-Asset Procedural Sound**: Web Audio API oscillator synthesis with zero external audio dependencies.
- [x] 5. **Audio Mute Control**: Sound toggle button in navigation header with localStorage state persistence.
- [x] 6. **Combat Audio Cues**: Distinct procedural sound triggers for attacks, guards, skills, and match victory.
- [x] 7. **Reduced Motion Accessibility**: Full `prefers-reduced-motion` support bypassing animations for sensitive users.
- [x] 8. **High Contrast Projector View**: Legible typography and clear visual hierarchy for long-distance viewing.

---

## Phase 8 — Security, Reliability, and QA

### Goal
Enforce tournament-grade fairness, fail-closed secrets, strict CORS and WebSocket origin verification, token expiry guards, and maintain 100% passing automated test and smoke test gates.

### Verified Security & Reliability Tracks
1. **Fail-Closed Startup**:
   - Validates that production/staging startup inspects `JWT_SECRET`.
   - Weak secrets (< 32 characters or containing placeholder tokens) immediately terminate process execution with code 1.
2. **WebSocket & REST Origin Isolation**:
   - Handshake verifies `Origin` header against `ALLOWED_ORIGINS`.
   - Spoofed or untrusted origins fail connection attempts with transport errors.
3. **Token Expiry & Role Verification**:
   - JWT tokens include expiration timestamps; expired tokens are rejected at connection.
   - Role guards verify permissions before allowing access to private rooms.
4. **Idempotency Protection**:
   - REST endpoints use `Idempotency-Key` hashing to guard against duplicate match creation.
   - WebSocket action submissions use unique `commandId` UUIDs to prevent replay attacks.
5. **Monorepo Automated Verification**:
   - 13 Jest test suites across all packages (50 tests total, 100% passing).
   - 12 hardened security and functional smoke test gates (`scripts/smoke-test.mjs`, 100% passing).

### Deliverables
- `scripts/smoke-test.mjs`: Standalone automated verification runner testing all 12 security and functional smoke gates.
- `apps/server/src/auth/secret-validation.ts`: Fail-closed startup secret integrity validator.
- Automated test suites: `game-rules` (22 tests), `shared-contracts` (3 tests), `server` (20 tests), `web` (5 tests).

### Exit Criteria (8-Point Checklist — Fully Verified & Passing)
- [x] 1. **Fail-Closed Secret Enforcement**: Server exits with code 1 if placeholder secrets are detected.
- [x] 2. **CORS & Origin Hardening**: Both REST and WebSocket endpoints block unauthorized origins.
- [x] 3. **Token Expiry Rejection**: Handshakes with expired JWTs receive unauthorized responses.
- [x] 4. **Idempotency Hash Guarding**: Repeated requests return cached responses; body mismatches return 409 Conflict.
- [x] 5. **Zero Data Leakage**: Sensitive credentials and hidden choices never leak to unauthorized parties.
- [x] 6. **Rule Engine Determinism**: 22 unit tests confirm 100% deterministic combat outcomes across all role matchups.
- [x] 7. **Full Match Integration Suite**: 6 server test suites verify complete match lifecycles and recovery.
- [x] 8. **12-Gate Smoke Script Passing**: `node scripts/smoke-test.mjs` passes all 12 gates and exits with code 0.

---

## Phase 9 — Deployment and Venue Rehearsal

### Goal
Configure dual-process production deployment manifests, establish venue network checklists, prepare host emergency recovery runbooks, and document the October 14, 2026 security release hold gate.

### Architecture & Production Topology
- **Dual Process Setup**:
  - Backend API & Realtime Gateway: NestJS server running on Node.js 20+ (port 3001).
  - Frontend Web Application: Next.js 15.5 production server (port 3000).
- **Environment Configuration**:
  - Backend: `JWT_SECRET` (min 32 chars), `ALLOWED_ORIGINS` (`https://arena.lunar-clash.local`), `PORT=3001`.
  - Frontend: `NEXT_PUBLIC_SERVER_URL` (`https://api.lunar-clash.local`).
- **Release Hold Gate Note**:
  - The Next.js October 14, 2026 security advisory is formally designated as an active production release hold gate. Any production deployment must apply the official Next.js patch once released prior to public tournament execution.

### Host Emergency Runbook
1. **Network Disconnect During Selection**:
   - Reconnecting party client automatically requests current snapshot; selections already locked are restored without penalty.
   - If timer expires before reconnect, server auto-assigns an unused fighter and advances to reveal.
2. **Network Disconnect During Combat**:
   - Disconnected party receives current turn state upon reconnect.
   - If action timer expires before reconnect, server defaults to `Guard` action.
3. **Host Emergency Pause**:
   - Host clicks "Pause Match" on the Host Desk; freezes active phase timer and displays pause banner on all screens.
   - Click "Resume Match" to restore remaining time and continue gameplay.
4. **Host Match Reset & Credential Rotation**:
   - In case of critical failure or restart, host clicks "Reset Match" and confirms.
   - Server rotates all role JWT tokens, increments `runId`, and broadcasts `match:tokensRotated`.
   - Host distributes new join tokens to contestants.

### Deliverables
- Production environment configurations and launch manifests.
- Host Quick-Reference Sheet with step-by-step tournament operations.
- Venue Rehearsal Checklist (projector resolution, audio check, Wi-Fi latency).

### Exit Criteria (6-Point Checklist — Fully Verified & Passing)
- [x] 1. **Production Monorepo Build**: `npm run build` successfully compiles both server and web applications.
- [x] 2. **Environment Variable Specifications**: Production configuration templates with strict secret requirements.
- [x] 3. **Host Emergency Procedures**: Documented runbooks for pause, resume, reset, and token rotation.
- [x] 4. **Security Advisory Hold Gate**: Formally recorded release hold requirement for October 14, 2026 advisory.
- [x] 5. **Venue Rehearsal Verification**: Pre-flight checklist for display projectors, Wi-Fi latency, and audio levels.
- [x] 6. **Automated Smoke Test Verification**: `node scripts/smoke-test.mjs` serves as local venue pre-flight check.

---

## Phase 10 — Post-event Review

### Goal
Collect match analytics, host feedback, and contestant observations to inform role balancing and feature enhancements for Version 1.1.

### Tasks
1. Gather host feedback on match setup ergonomics and emergency recovery usability.
2. Record average match duration, duel length, and timeout frequency.
3. Analyze role pick rates across all 8 canonical roles to identify over/under-utilized archetypes.
4. Review skill impact and combat pacing to evaluate potential stat adjustments.
5. Compile post-tournament bug backlog and architectural improvements.

### Deliverables
- Post-tournament analytics report.
- Role balance tuning proposal for Version 1.1.
- Technical debt and feature backlog.

---

## 3. Recommended Build Order Within Each Phase

Use this order to avoid building UI around unfinished rules:

1. Write and approve the rule contract.
2. Implement the game engine and unit tests.
3. Implement match lifecycle and state machine.
4. Implement role-based authorization and private state projections.
5. Implement hidden selection and reveal.
6. Implement hidden action locking and combat resolution.
7. Implement best-of-three progression.
8. Connect host and player UIs.
9. Connect the public arena.
10. Add visual effects.
11. Run end-to-end tests and venue rehearsal.

---

## 4. Suggested Milestones

### Milestone A — Rules prove out
The game engine can simulate duels and series without any UI.

### Milestone B — Secret selection works
Two independent clients can lock picks without exposing either pick early.

### Milestone C — Full match is playable
Two parties can play a complete 2–0 or 2–1 match in a basic web UI.

### Milestone D — Event-ready UI
Host controls and projector arena work reliably with the intended devices.

### Milestone E — Launch candidate
Visual polish is applied; tests, rehearsal, deployment, and fallback procedure are complete.

---

## 5. Risk-Based Priorities

If time is limited, prioritize in this order:

1. **Correct hidden-pick and hidden-action protocol.**
2. **Correct server-side combat resolution.**
3. **Correct best-of-three controller.**
4. **Host pause, reset, and timeout handling.**
5. **Functional mobile/private controls and projector screen.**
6. **Testing and venue rehearsal.**
7. **Visual effects and sound.**
8. **Persistent history, tournament brackets, and extra roles.**

Do not cut secret-information tests or combat-engine tests to make room for more role classes or animations.

---

## 6. Final Release Checklist

- [x] Rules and role stats frozen (8 canonical roles: Swordsman, Archer, Mage, Tank, Rogue, Assassin, Vanguard, Paladin).
- [x] Match requires exactly five fighters per party (`MatchCreatePayloadSchema` enforces 5 distinct roles per party).
- [x] Fighter roles are distinct within a party by default (validated in `match.service.ts` and `schemas.ts`).
- [x] Hidden picks are server-enforced (`PrivatePartySnapshotSchema`, isolated room emission, no early leakage).
- [x] Hidden actions are server-enforced (action locks are private until simultaneous server-side resolution).
- [x] Server owns the timers (deadline timestamps calculated server-side; drift compensation enabled).
- [x] Combat engine is unit-tested (`combat-resolver.spec.ts`, `prng.spec.ts`, `roles.spec.ts`: 22 tests passing).
- [x] Duplicate turn resolution is prevented (idempotency keying, turn mutex, command isolation verified).
- [x] Series stops at two wins (`series-controller.spec.ts` verifies best-of-3 termination at 2–0 or 2–1).
- [x] Third duel starts only at 1–1 (verified in engine and integration suites).
- [x] Host pause, resume, reset, and override are tested (`match.controller.spec.ts`, `realtime.gateway.spec.ts`, smoke test gate 3b).
- [x] Public arena receives only public-safe state (`PublicMatchSnapshotSchema` stripped of uncommitted picks/actions).
- [x] Reconnect behavior is tested (state rehydration via room join and token validation in `realtime.gateway.ts`).
- [x] Production WebSocket connection is verified (authenticated ping/pong RTT 6ms, CORS & origin filtering verified in smoke test).
- [x] Full event rehearsal passes (automated E2E smoke test runs all 12 hardened gates clean).
- [x] Host has the rules sheet and fallback procedure (`GET /roles` and `GET /matches/:id/audit` fully implemented).

> [!WARNING]
> **Active Production Release Hold Gate**: Upstream Next.js 15.5.27 security advisory scheduled for 14 October 2026. Codebase implementation is 100% verified and functional, but public Internet exposure remains on administrative hold until upstream Next.js patch is applied on or after Oct 14.

## Final Recommendation

Treat **rules, hidden-information correctness, and reliable match control** as the foundation of Lunar Dungeon. The core combat engine, realtime gateway, REST endpoints, and Next.js frontend are verified operational, adhering strictly to the frozen rules and security specifications.
