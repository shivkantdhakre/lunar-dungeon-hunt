# AAYANSH'26 --- Lunar Dungeon: Party Clash

## Product, Functional, Design & Technical Documentation

**Document type:** Product Requirements Document (PRD), Functional
Requirements Document (FRD), UX/UI Design Specification, Software
Architecture, Technical Design, API/Event Contract, Data Model, QA Plan,
and Delivery Roadmap\
**Version:** 1.0\
**Status:** Draft for implementation\
**Event context:** AAYANSH'26 --- Lunar Night\
**Game mode:** Live Party-versus-Party PvP\
**Primary format:** Best of three duels\
**Platform:** Responsive web application\
**Recommended stack:** Next.js, React, Tailwind CSS, NestJS, Socket.IO,
PostgreSQL

------------------------------------------------------------------------

## 1. Executive Summary

Lunar Dungeon: Party Clash is a browser-based multiplayer game for the
second, surprise round of **Dungeon Hunt**, an event associated with
AAYANSH'26 and its **Lunar Night** theme.

Two parties compete in a live dungeon arena. Each party has five
participants, and each participant is assigned a distinct fantasy combat
role. Before every duel, both parties secretly select one eligible
fighter. Neither party may see the opponent's selection before both
selections are locked. The server then reveals the two fighters and
begins a short, turn-based combat encounter.

The first party to win two duels wins the match and advances. The third
duel is skipped if a party wins the first two duels. A host can run the
event from a control screen while a projector-friendly arena screen
displays the match for the audience.

The game is intended to feel like a compact fantasy tournament rather
than a conventional quiz or a simultaneous multi-team race. Role
selection, hidden information, tactical actions, clear rules, and a
dramatic reveal are the central experience.

### 1.1 Product goals

1.  Deliver a reliable, easy-to-run live game for an in-person college
    event.
2.  Make hidden fighter selection fair: no opponent selection is exposed
    before both parties lock.
3.  Give each role a meaningful identity and a balanced ability.
4.  Keep a duel short enough for an event schedule while leaving room
    for strategy.
5.  Make the arena understandable to players, the host, judges, and
    spectators.
6.  Support a host-controlled match lifecycle, including reset and
    recovery from common connection problems.

### 1.2 Non-goals for the first release

-   A persistent online RPG or open-world dungeon.
-   Player accounts, public matchmaking, ranked ladders, or a long-term
    progression economy.
-   Real-money purchases, paid items, loot boxes, or monetization.
-   Real-time free-movement combat, physics, or multiplayer action-game
    networking.
-   AI-controlled opponents.
-   Cross-match inventory or character progression.
-   A mobile native app. The first release is a responsive web app.

------------------------------------------------------------------------

## 2. Product Overview

### 2.1 Product name

**Lunar Dungeon: Party Clash**

Event-facing title:

**DUNGEON HUNT --- THE LUNAR CLASH**

Tagline:

**Choose your champion. Hide your strategy. Claim the Lunar Relic.**

### 2.2 Core experience

1.  The host creates a match and registers two parties.
2.  Each party has five participants and five distinct roles.
3.  Both parties independently select one available fighter for Duel 1.
4.  Each side locks its choice privately.
5.  When both choices are locked, the server reveals both fighters.
6.  Players choose combat actions privately and lock them.
7.  Once both actions are locked, the server resolves the turn.
8.  The duel ends when a fighter is defeated or the turn limit triggers
    a tiebreak rule.
9.  The winner's party receives one duel point.
10. The next duel begins with a new hidden selection, unless one party
    has already won two duels.
11. The host confirms the result and advances the winning party.

### 2.3 Match format

-   Parties per match: 2
-   Participants per party: 5
-   Fighters per party: 5
-   Duels per match: 2 or 3
-   Match winner: first party to win 2 duels
-   Fighter reuse: disabled by default within a match; make this a match
    setting if the event organizer wants repeat picks
-   Action selection: simultaneous, hidden until both players lock
-   Combat resolution: server-authoritative
-   Audience display: public arena screen
-   Private controls: each party's device or private browser session

### 2.4 Suggested event timing

  Stage                          Target duration
  ---------------------------- -----------------
  Match setup and readiness         1--2 minutes
  Fighter selection per duel      20--30 seconds
  Combat turn                     10--15 seconds
  Typical duel                      1--3 minutes
  Match result and reset          30--60 seconds
  Target match duration            6--12 minutes

Actual duration depends on the number of combat turns, host narration,
and connection delays. The game should have configurable timers so the
organizer can adapt to the event schedule.

------------------------------------------------------------------------

## 3. Product Requirements Document (PRD)

### 3.1 Problem statement

A live event needs a short, competitive activity where teams face each
other directly. The game should be easy to understand from a projector,
but it should still reward planning and decision-making. A normal quiz
or race does not create the desired party-combat fantasy. A digital
implementation can hide selections fairly, resolve combat consistently,
and give the host control over the match.

### 3.2 Target users

#### Players

-   Five participants per party.
-   Need to understand their roles and abilities quickly.
-   Need a private interface to choose a fighter and combat action.
-   Should not be able to view the opponent's unrevealed choice.

#### Host / Game Master

-   Creates and starts matches.
-   Registers party names and roles.
-   Monitors readiness and timers.
-   Pauses, resumes, resets, or resolves a match when necessary.
-   Announces the winner.

#### Audience

-   Watches the public arena display.
-   Needs clear fighter names, role icons, HP bars, duel score, turn
    log, and victory state.
-   Must not see private selections before reveal.

#### Event administrator

-   Configures role definitions, timers, combat balance, and match
    settings.
-   Can review completed results and reset the game for the next pair of
    parties.

### 3.3 User stories

**Player** - As a player, I want to see my party's available fighters so
I can choose a strategic matchup. - As a player, I want my fighter
selection to remain private until both parties lock. - As a player, I
want to choose an action without the opponent seeing it first. - As a
player, I want to understand my fighter's HP, attack, guard, and special
skill. - As a player, I want clear feedback when my selection or action
is locked. - As a player, I want to know when my party wins a duel or
the overall match.

**Host** - As a host, I want to create a match and enter two party
names. - As a host, I want to assign or verify five distinct roles per
party. - As a host, I want to see which side is ready without seeing its
private pick. - As a host, I want the game to reveal picks only after
both sides lock. - As a host, I want to pause a match if there is a
technical problem. - As a host, I want a clear, auditable result for
each duel. - As a host, I want to reset the arena without accidentally
carrying state from the previous match.

**Audience** - As a spectator, I want to see the duel score and current
fighters. - As a spectator, I want combat events to be readable and
dramatic. - As a spectator, I want the winner to be obvious without
needing to understand every underlying rule.

### 3.4 Product principles

1.  **Fairness first:** hidden choices are enforced by the server, not
    just hidden with frontend styling.
2.  **Fast to learn:** a player should understand the basic rules in
    under two minutes.
3.  **Visible consequences:** actions, damage, shielding, and turn
    outcomes must be explicit.
4.  **No role should dominate:** roles can have strengths and
    weaknesses, but no single role should guarantee a win.
5.  **Host remains in control:** the host can pause or recover a match
    without secretly changing a result.
6.  **Spectator clarity:** the public screen shows only information that
    is meant to be public.
7.  **Event resilience:** brief connection drops should not immediately
    ruin a match.

### 3.5 Success metrics

For an initial event release, measure:

-   At least 95% of matches finish without a software-blocking issue.
-   No private fighter pick or action is revealed before both parties
    lock.
-   A host can set up a match in under two minutes.
-   A new player can complete a duel after a short rules explanation.
-   The public arena screen remains synchronized with the authoritative
    server state.
-   Match results can be reset cleanly between competing party pairs.

These are target acceptance measures, not claims about an existing
implementation.

### 3.6 Scope prioritization

#### P0 --- Required for MVP

-   Host creates and controls a match.
-   Two parties, five participants/roles each.
-   Role assignment and roster validation.
-   Hidden fighter selection with simultaneous lock.
-   Fighter reveal after both locks.
-   Hidden combat action selection.
-   Server-authoritative turn resolution.
-   HP, damage, guard, skills, turn limit, duel winner.
-   Best-of-three match controller.
-   Projector-friendly public arena.
-   Private player/team controls.
-   Match reset and basic disconnect handling.
-   Basic event log and result summary.

#### P1 --- Strongly recommended

-   Editable role balance settings.
-   Configurable selection and action timers.
-   Sound toggles and lightweight animations.
-   Reconnect flow and server-side state recovery.
-   Exportable match result summary.
-   Host override with reason recorded in the event log.
-   Practice/demo mode.

#### P2 --- Later

-   Tournament bracket management.
-   Persistent match history across events.
-   Advanced combat animations.
-   Multiple visual themes.
-   Analytics dashboard.
-   Spectator commentary mode.

------------------------------------------------------------------------

## 4. Functional Requirements Document (FRD)

### 4.1 Match setup

**FR-MATCH-001:** The host can create a new match.\
**FR-MATCH-002:** The host can enter a display name for each party.\
**FR-MATCH-003:** Each party must contain exactly five distinct fighters
before the match starts.\
**FR-MATCH-004:** Each fighter must have one role selected from the
enabled role pool.\
**FR-MATCH-005:** Duplicate roles within a party are prohibited by
default. This can be changed through match configuration if the
organizer wants a different ruleset.\
**FR-MATCH-006:** The host can confirm both parties and start the
match.\
**FR-MATCH-007:** Once a match starts, roster changes are disabled
unless the host pauses and explicitly resets the match.

**Validation** - Party names cannot be empty. - Each party has five
fighters. - Every fighter has a valid role. - Role identifiers must
exist in the active role configuration. - A role assignment cannot be
changed after the first duel begins without a full match reset.

### 4.2 Secret fighter selection

**FR-PICK-001:** At the start of each duel, both parties can choose one
eligible fighter.\
**FR-PICK-002:** The active party interface displays only its own roster
and selection state.\
**FR-PICK-003:** The opposing party cannot access the selected fighter's
identity before both parties lock.\
**FR-PICK-004:** The public arena cannot reveal either selection before
both parties lock.\
**FR-PICK-005:** A party can change its choice until it locks or the
selection timer expires.\
**FR-PICK-006:** After locking, a party cannot change its selection
unless the host resets that selection phase.\
**FR-PICK-007:** The server reveals both choices in the same reveal
transition after confirming both locks.\
**FR-PICK-008:** If fighter reuse is disabled, a fighter who has already
fought in the current match cannot be selected again.\
**FR-PICK-009:** The UI shows "Selection locked" without revealing the
opponent's pick.\
**FR-PICK-010:** The server validates that the selected fighter belongs
to that party and is eligible.

**Timeout rule** - Recommended default: if a party does not lock before
the timer expires, the server automatically chooses one of that party's
eligible unused fighters. - The automatic choice must be generated
server-side. - The public interface may announce "Time expired ---
fighter assigned" but should not reveal the identity until both
selections are locked or auto-assigned. - The auto-pick method must be
documented and consistent. For the MVP, select randomly from eligible
fighters using a server-side random generator.

### 4.3 Combat action selection

**FR-ACTION-001:** After fighter reveal, each side chooses one action
per turn.\
**FR-ACTION-002:** The action is private until both sides lock.\
**FR-ACTION-003:** Available base actions are Strike and Guard.\
**FR-ACTION-004:** Each role has a unique Skill action with
role-specific rules.\
**FR-ACTION-005:** A skill with a limited use count cannot be used after
its uses are exhausted.\
**FR-ACTION-006:** The server validates every action against the
fighter's role and current state.\
**FR-ACTION-007:** The server resolves the turn only after both sides
have locked or a configured timeout rule has been applied.\
**FR-ACTION-008:** The public arena displays the actions only after
resolution begins.\
**FR-ACTION-009:** The combat log explains damage, shielding, skill
effects, and remaining HP.\
**FR-ACTION-010:** Clients cannot submit arbitrary damage, HP, skill
results, or winner values.

### 4.4 Combat and duel resolution

**FR-COMBAT-001:** Every fighter starts with the HP defined in the
active role configuration.\
**FR-COMBAT-002:** HP cannot exceed the role's maximum HP unless a
future ruleset explicitly supports temporary overheal.\
**FR-COMBAT-003:** HP cannot fall below zero.\
**FR-COMBAT-004:** Damage and shielding are calculated on the server.\
**FR-COMBAT-005:** A duel ends when a fighter reaches zero HP.\
**FR-COMBAT-006:** If both fighters reach zero HP in the same
resolution, apply the configured tie-break rule.\
**FR-COMBAT-007:** If the turn limit is reached and both fighters remain
alive, the fighter with higher remaining HP wins.\
**FR-COMBAT-008:** If remaining HP is equal, compare remaining shield;
if still equal, use a sudden-death rule.\
**FR-COMBAT-009:** A duel winner gives one duel point to their party.\
**FR-COMBAT-010:** The server prevents additional turns after the duel
is marked complete.

### 4.5 Best-of-three match

**FR-SERIES-001:** A match consists of a maximum of three duels.\
**FR-SERIES-002:** The first party to win two duels is the match
winner.\
**FR-SERIES-003:** If the score reaches 2--0, the third duel is
skipped.\
**FR-SERIES-004:** If the score is 1--1 after two duels, Duel 3 is
mandatory.\
**FR-SERIES-005:** The series score is shown on the public arena after
each duel.\
**FR-SERIES-006:** The winner is locked after the match completes unless
the host performs an audited override.\
**FR-SERIES-007:** The host can reset the match to a new lobby for the
next pair of parties.

### 4.6 Host controls

**FR-HOST-001:** The host can pause an active match.\
**FR-HOST-002:** While paused, no selection timer or combat turn can
resolve.\
**FR-HOST-003:** The host can resume a paused match.\
**FR-HOST-004:** The host can reset a match after confirmation.\
**FR-HOST-005:** The host can force a phase transition only through an
explicit override action.\
**FR-HOST-006:** Any override records the host identity, timestamp,
reason, and previous/new state.\
**FR-HOST-007:** The host can view the full event log.\
**FR-HOST-008:** The host can restart a completed match for a rematch,
but the completed result remains in history if persistence is enabled.

### 4.7 Public arena

**FR-ARENA-001:** The public arena displays the match title, party
names, series score, current duel, fighter portraits/icons, roles, HP
bars, shield values, turn number, and combat log.\
**FR-ARENA-002:** It must not show unrevealed fighter picks or
unrevealed actions.\
**FR-ARENA-003:** The display must remain readable at projector
distance.\
**FR-ARENA-004:** Animations must not block the host from controlling
the match.\
**FR-ARENA-005:** A reduced-motion setting must be available or
respected where practical.\
**FR-ARENA-006:** The victory state clearly identifies the party that
advances.

### 4.8 Connection and recovery

**FR-CONN-001:** A disconnected player can reconnect to the same match
using a valid session token or room credential.\
**FR-CONN-002:** Reconnecting clients receive the current authorized
view of the match.\
**FR-CONN-003:** Private picks and actions are not included in
unauthorized reconnection snapshots.\
**FR-CONN-004:** If a player disconnects during a choice phase, the
phase continues until the timer expires or the host pauses.\
**FR-CONN-005:** If the timer expires without an action, apply the
documented timeout policy.\
**FR-CONN-006:** A reconnect must not allow a previously locked action
to be changed.\
**FR-CONN-007:** The host can pause if a device or network issue
materially affects the match.

### 4.9 Acceptance criteria

The MVP is acceptable when all of the following pass:

1.  A host can create a match with two five-fighter parties.
2.  Each party can choose a fighter without revealing that choice to the
    other party.
3.  Neither pick is revealed until both are locked.
4.  Both players can choose combat actions privately.
5.  The server resolves damage and status effects deterministically from
    the locked actions and match state.
6.  A duel ends correctly on defeat or the configured turn limit.
7.  The series ends immediately when a party reaches two wins.
8.  A 1--1 series proceeds to Duel 3.
9.  The public arena never displays secret information early.
10. A reset creates a clean match state.
11. A disconnected player can rejoin without changing locked choices.
12. Host overrides are logged.
13. The game is usable on common desktop and mobile browsers.

------------------------------------------------------------------------

## 5. Game Design Document (GDD)

### 5.1 Game fantasy and tone

The players are rival adventuring parties entering a moonlit arena
beneath an ancient dungeon. Each party sends a champion into the Lunar
Clash. The audience sees the champion reveal, the tactical fight, and
the duel result. The winning party moves one step closer to claiming the
Lunar Relic.

Tone: mysterious, competitive, heroic, and theatrical. Avoid excessively
graphic violence. Combat is represented through stylized impacts,
magical effects, shield flashes, and HP changes.

### 5.2 Core loop

**Select → Lock → Reveal → Choose actions → Resolve combat → Award duel
point → Repeat → Crown winner**

### 5.3 Role pool

Role values below are initial balance proposals. They must be tuned
through playtesting; they are not proven balanced values.

  -------------------------------------------------------------------------------
  Role                    HP   Basic Strike Identity     Skill      Suggested
                                                                    skill effect
  ----------- -------------- -------------- ------------ ---------- -------------
  Swordsman              100             22 Balanced     Blade      Deal 32
                                            melee        Breaker    damage; once
                                                                    per duel

  Archer                  90             20 Precision    Piercing   Deal 26
                                                         Shot       damage;
                                                                    ignores Guard
                                                                    reduction

  Mage                    85             17 Magic burst  Arcane     Deal 30 magic
                                                         Burst      damage; can
                                                                    be
                                                                    interrupted
                                                                    by a
                                                                    successful
                                                                    Strike under
                                                                    the interrupt
                                                                    rule

  Tank                   125             15 Durability   Shield     Deal 18
                                                         Bash       damage and
                                                                    gain 20
                                                                    shield

  Rogue                   95             18 Evasion and  Shadow     Deal 20
                                            tactics      Feint      damage and
                                                                    reduce the
                                                                    next incoming
                                                                    hit by 12

  Assassin                85             24 High-risk    Execute    Deal 34
                                            burst        Mark       damage if the
                                                                    target is
                                                                    below 40% HP;
                                                                    otherwise
                                                                    deal 22

  Vanguard               110             20 Initiative   First      Deal 28
                                                         Assault    damage;
                                                                    ignores the
                                                                    first 5
                                                                    points of
                                                                    Guard
                                                                    reduction

  Paladin                110             17 Defense and  Radiant    Deal 16
                                            recovery     Ward       damage and
                                                                    gain 18
                                                                    shield

  Healer                  95             14 Sustain      Moon Mend  Restore 18
                                                                    HP, capped at
                                                                    maximum HP;
                                                                    once per duel

  Warlock                 90             18 Damage over  Lunar Hex  Deal 16
                                            time                    damage now
                                                                    and 6 damage
                                                                    at the end of
                                                                    the next two
                                                                    turns

  Berserker              100             25 Aggression   Reckless   Deal 36
                                                         Blow       damage and
                                                                    take 8
                                                                    self-damage

  Bard                    95             15 Flexible     Battle     Gain 12
                                            support      Hymn       shield and
                                                                    increase next
                                                                    Strike by 6
  -------------------------------------------------------------------------------

**Implementation note:** The MVP may launch with the five core roles
(Swordsman, Archer, Mage, Tank, Rogue) and add the expanded pool after
testing. If all twelve roles are enabled, each party still receives five
distinct roles, and the role assignment process should avoid duplicate
roles within a party by default.

### 5.4 Role assignment

Recommended options:

-   **Host assignment:** the host assigns roles before the match.
-   **Random assignment:** the server randomly assigns five distinct
    roles from the enabled pool to each party.
-   **Draft assignment (later):** parties choose roles in a controlled
    draft phase.

For the first event, use host assignment or server-generated random
assignment. Do not let a player change their role after seeing the
opposing party's roster unless the event rules explicitly allow it.

### 5.5 Combat rules

#### Base actions

**Strike** - Uses the fighter's basic Strike value. - Can interrupt
Mage's Arcane Burst if the target selected Arcane Burst and the game's
interrupt condition is met. - Does not consume the role's skill use.

**Guard** - Reduces incoming Strike damage by a configured percentage. -
Suggested MVP rule: Guard reduces incoming Strike damage by 50%, rounded
down. - Guard does not reduce skill damage unless the skill description
explicitly says otherwise. - Guard does not cause damage by itself.

**Skill** - Activates the fighter's unique ability. - Skills have clear
use limits, generally once per duel. - Skill effects resolve according
to a documented priority order. - A skill that cannot be used because it
has already been spent is rejected by the server. The client should
prevent this choice in normal use.

#### Recommended resolution order

To avoid ambiguous interactions, implement each turn in this order:

1.  Validate both locked actions against the current state.
2.  Determine whether either action is an interrupting Strike.
3.  Apply interrupt effects.
4.  Resolve defensive stance and shields.
5.  Resolve direct damage and healing according to skill-specific
    priority.
6.  Apply damage-over-time effects.
7.  Clamp HP to the valid range.
8.  Check defeat and tie conditions.
9.  Increment the turn counter if the duel continues.
10. Emit the public turn result and next authorized state.

This order is a starting contract. If balance testing requires a
different order, update the rules and test suite together.

#### Damage calculation

For a basic Strike:

`damage = max(0, attack_value - applicable_reduction)`

If the target is Guarding:

`applicable_reduction = floor(attack_value * 0.50)`

For a skill, use the skill's specified base damage and effect rules. Do
not apply the basic Guard reduction to every skill by default. Shield
absorbs damage before HP:

`shield_absorbed = min(current_shield, incoming_damage)`

`remaining_damage = incoming_damage - shield_absorbed`

`new_hp = max(0, current_hp - remaining_damage)`

Healing cannot exceed maximum HP:

`new_hp = min(max_hp, current_hp + healing_amount)`

### 5.6 Duel end conditions

A duel ends if: - One fighter reaches 0 HP. - Both fighters reach 0 HP
in the same resolution. - The maximum turn count is reached. - The host
performs a valid, logged administrative resolution.

Suggested MVP configuration: - Maximum turns: 6. - At turn limit:
compare remaining HP percentage, then remaining shield. - If still tied:
use a sudden-death action, where both fighters secretly choose Strike or
Guard; the server resolves one additional turn. If still tied, the host
can trigger a short external tiebreaker or use a documented
deterministic tie rule.

**Fairness note:** A random coin flip should be a last resort. Prefer a
sudden-death turn or a quick, neutral skill challenge.

### 5.7 Best-of-three rules

-   A win in a duel awards one series point.
-   The first party to reach two points wins.
-   A 2--0 result ends the series immediately.
-   A 1--1 result triggers the third duel.
-   Fighter reuse is **disabled by default** so a party must use three
    different members if all three duels are played. This setting should
    be configurable by the host.
-   A fighter's HP and spent skill uses reset when a new duel begins;
    the same fighter cannot be selected again if reuse is disabled.
-   If fighter reuse is enabled, each new duel starts with full HP, full
    shield, and a refreshed skill use.

### 5.8 Timeout and disconnect policy

Recommended defaults: - Fighter selection: 25 seconds. - Combat action:
12 seconds per turn. - If a player times out during fighter selection:
server auto-selects a random eligible fighter. - If a player times out
during combat: server selects Guard as the safe default. - A timeout is
visible in the public log, but private information is not exposed before
the relevant reveal. - The host can pause the match for a genuine
device/network issue. - Avoid an automatic forfeit on the first brief
disconnect. The host should have a configurable grace period.

### 5.9 Anti-stall and abuse prevention

-   Every selection/action phase has a deadline.
-   Locked choices cannot be edited by clients.
-   The server rejects duplicate submissions for an already locked
    phase.
-   The server rejects actions from the wrong team, wrong fighter, wrong
    turn, or wrong phase.
-   The server owns the clock and phase transition.
-   The host cannot silently change a result; overrides must be logged.
-   If the server receives a duplicate event because of a reconnect or
    retry, process it idempotently.

------------------------------------------------------------------------

## 6. UX and Visual Design Specification

### 6.1 Art direction

The visual identity should align with **Lunar Night**:

-   Midnight indigo and deep navy as the main surfaces.
-   Moonlit blue for secondary surfaces and magical effects.
-   Warm ivory for readable text.
-   Muted antique gold for borders, highlights, and important actions.
-   Amber as a restrained accent for victory, relics, and event-specific
    details.
-   Full-moon motifs, rune marks, ancient stone, subtle paper grain, and
    soft particle effects.

Avoid excessive glow, overdecorated panels, tiny text, or effects that
make the interface difficult to read from a projector. The aesthetic
should feel like a carefully art-directed fantasy game, not a generic
neon dashboard.

### 6.2 UI principles

1.  The next required action should always be obvious.
2.  Private controls and public display should be separate routes/views.
3.  A locked action must have a clear state.
4.  Never use color alone to communicate a result; pair it with
    labels/icons.
5.  Keep the public arena readable from a distance.
6.  Use animations to support the result, not to delay it.
7.  Show rules and skill descriptions in concise language.

### 6.3 Required screens

#### A. Host lobby

-   Event title and game logo.
-   Party A and Party B names.
-   Five fighter slots per party.
-   Role selection/assignment.
-   Match settings: timers, role pool, fighter reuse, max turns.
-   Ready indicators.
-   Start Match button.
-   Validation messages for incomplete rosters.

#### B. Private party control

-   Party name and match code.
-   Own roster only.
-   Fighter cards with role, HP, basic attack, and skill.
-   Selection countdown.
-   Select and Lock controls.
-   Locked state.
-   Waiting-for-opponent message.
-   No opponent roster selection state before reveal.

#### C. Public arena

-   AAYANSH'26 / Lunar Dungeon branding.
-   Party names and series score.
-   Duel number and phase.
-   Two fighter panels with portrait/icon, role, HP, shield, and skill
    availability.
-   Combat action reveal.
-   Turn history / combat log.
-   Selection reveal animation.
-   Duel result transition.
-   Match victory / advancement screen.

#### D. Host control panel

-   Current phase and timer.
-   Ready/locked status per party.
-   Pause and Resume.
-   Reset with confirmation.
-   View full event log.
-   Force timeout resolution, only if permitted.
-   Administrative override with reason.
-   Start next duel / close match.

#### E. Match result

-   Winning party.
-   Series score.
-   Duel-by-duel results.
-   Final fighters and outcomes.
-   Reset for next match.
-   Optional result export.

### 6.4 Responsive behavior

**Desktop/projector** - Arena uses a wide two-column layout. - Large HP
bars and role labels. - Combat log visible without scrolling where
possible. - Host controls should not appear on the public display.

**Mobile** - Private party controls are optimized for touch. - Fighter
cards use a compact vertical list or grid. - Lock button remains visible
and easy to tap. - Text and skill descriptions must not require
horizontal scrolling. - Public arena may use a stacked layout if viewed
on a phone.

### 6.5 Accessibility and usability

-   Support keyboard navigation for host controls.
-   Visible focus states.
-   Adequate contrast for text and HP indicators.
-   Respect reduced-motion preferences where practical.
-   Do not rely on sound for important feedback.
-   Use readable font sizes and concise copy.
-   Provide clear error and reconnect messages.

### 6.6 Sample UI copy

-   Lobby: "Two parties. One Lunar Relic."
-   Pick phase: "Choose your champion. Your pick stays hidden until both
    parties lock."
-   Locked state: "Champion locked. Waiting for the opposing party."
-   Reveal: "The champions have been chosen."
-   Action phase: "Choose your action. Both actions reveal together."
-   Timeout: "Time expired. The dungeon has chosen your action."
-   Duel win: "Duel won --- your party earns 1 point."
-   Match win: "The Lunar Relic belongs to your party. You advance."

------------------------------------------------------------------------

## 7. System Architecture

### 7.1 Recommended stack

  -----------------------------------------------------------------------
  Layer                   Technology              Responsibility
  ----------------------- ----------------------- -----------------------
  Web client              Next.js + React +       Lobby, player controls,
                          TypeScript              arena, host panel

  Styling                 Tailwind CSS            Responsive design and
                                                  visual system

  Realtime transport      Socket.IO               Match-room events and
                                                  state updates

  API/backend             NestJS + TypeScript     Match orchestration,
                                                  validation, rules,
                                                  authorization

  Database                PostgreSQL              Match configuration and
                                                  durable results

  ORM                     Prisma or Drizzle       Typed database access

  Test tooling            Jest/Vitest +           Unit, integration, and
                          Playwright              browser tests

  Deployment              Web host + Node backend Frontend and WebSocket
                          host                    server
  -----------------------------------------------------------------------

The initial MVP can keep match state in backend memory if the server
runs as one instance and the event is short-lived. PostgreSQL is still
useful for role definitions, configuration, and result records. If
multiple backend instances are introduced, use a shared state strategy
and Socket.IO adapter; do not assume in-memory match state will be
shared.

### 7.2 High-level architecture

``` mermaid
flowchart TB
    Host[Host Browser]
    TeamA[Party A Private Device]
    TeamB[Party B Private Device]
    Arena[Public Arena / Projector]

    Web[Next.js Web Application]
    API[NestJS Application]
    Gateway[Socket.IO Gateway]
    Engine[Authoritative Game Engine]
    Store[(PostgreSQL)]
    Logs[Event / Audit Log]

    Host --> Web
    TeamA --> Web
    TeamB --> Web
    Arena --> Web

    Web <--> Gateway
    Gateway --> API
    API --> Engine
    Engine --> Store
    Engine --> Logs
    Engine --> Gateway
    Gateway --> Web
```

### 7.3 Architectural responsibilities

**Next.js** - Renders the public arena and private control views. -
Handles route-level access and client-side interaction. - Never
determines the authoritative combat result. - Never broadcasts secret
selections to unauthorized clients.

**NestJS** - Owns match lifecycle and permissions. - Validates all
incoming commands. - Manages phase transitions and timers. - Calls the
game engine. - Emits authorized snapshots and public events.

**Game engine** - Pure or mostly pure domain logic. - Resolves actions
from a known match state. - Calculates damage, shield, healing, skill
usage, and duel results. - Should be testable without a browser or
Socket.IO connection.

**PostgreSQL** - Stores role configuration and completed match
results. - Can store match snapshots and event logs if restart recovery
is required. - Should not be the only place that enforces authorization;
the backend must validate access.

### 7.4 Recommended module layout

``` text
lunar-dungeon/
├── apps/
│   ├── web/
│   │   ├── app/
│   │   │   ├── page.tsx
│   │   │   ├── host/[matchId]/page.tsx
│   │   │   ├── party/[matchId]/page.tsx
│   │   │   └── arena/[matchId]/page.tsx
│   │   ├── components/
│   │   │   ├── lobby/
│   │   │   ├── fighter/
│   │   │   ├── arena/
│   │   │   ├── combat/
│   │   │   └── host/
│   │   ├── hooks/
│   │   ├── lib/socket/
│   │   └── styles/
│   └── server/
│       ├── src/
│       │   ├── app.module.ts
│       │   ├── matches/
│       │   ├── parties/
│       │   ├── roles/
│       │   ├── combat/
│       │   ├── realtime/
│       │   ├── auth/
│       │   ├── persistence/
│       │   └── audit/
│       └── test/
├── packages/
│   ├── game-rules/
│   │   ├── roles.ts
│   │   ├── combat.ts
│   │   ├── match-state.ts
│   │   └── types.ts
│   └── shared-contracts/
├── docs/
│   └── LUNAR_DUNGEON_DOCUMENTATION.md
└── README.md
```

This is a suggested structure, not a requirement to use a monorepo. A
single repository is convenient because the frontend, backend, and
shared rules use TypeScript contracts.

### 7.5 Match state machine

``` mermaid
stateDiagram-v2
    [*] --> Lobby
    Lobby --> ReadyCheck: Host starts setup
    ReadyCheck --> PickPhase: Both parties valid
    PickPhase --> RevealPhase: Both picks locked or auto-picked
    RevealPhase --> ActionPhase
    ActionPhase --> ResolveTurn: Both actions locked or timed out
    ResolveTurn --> ActionPhase: Duel continues
    ResolveTurn --> DuelComplete: Fighter defeated or turn limit
    DuelComplete --> PickPhase: Series tied and fewer than 3 duels
    DuelComplete --> MatchComplete: Party reaches 2 wins
    MatchComplete --> Lobby: Host resets for next match
    PickPhase --> Paused: Host pauses
    ActionPhase --> Paused: Host pauses
    Paused --> PickPhase: Resume pick phase
    Paused --> ActionPhase: Resume action phase
```

Implementation should preserve the exact phase that was paused so resume
returns to the correct state. Do not let clients choose their own phase.

------------------------------------------------------------------------

## 8. Data Model

### 8.1 Core entities

**Match** - `id` - `code` - `status` - `phase` - `currentDuelNumber` -
`partyAId` - `partyBId` - `scoreA` - `scoreB` - `settings` -
`createdAt` - `startedAt` - `completedAt` - `winnerPartyId`

**Party** - `id` - `matchId` - `name` - `side` (`A` or `B`) -
`sessionCredentialHash` or equivalent secure session reference

**Fighter** - `id` - `partyId` - `roleId` - `displayName` -
`portraitKey` - `isEligible` - `duelsUsed`

**RoleDefinition** - `id` - `name` - `description` - `maxHp` -
`baseAttack` - `skillDefinition` - `enabled`

**Duel** - `id` - `matchId` - `number` - `status` - `fighterAId` -
`fighterBId` - `winnerPartyId` - `turnNumber` - `startedAt` -
`completedAt`

**FighterCombatState** - `duelId` - `fighterId` - `currentHp` -
`currentShield` - `skillUsesRemaining` - `statusEffects`

**Turn** - `id` - `duelId` - `turnNumber` - `actionA` - `actionB` -
`resolution` - `createdAt`

**AuditEvent** - `id` - `matchId` - `actorType` - `actorId` -
`eventType` - `reason` - `metadata` - `createdAt`

### 8.2 Persistence strategy

For the MVP: - Persist role configuration and completed match
summaries. - Keep live match state in memory if there is only one
backend instance and a process restart during the event is an accepted
risk. - If event reliability requires recovery, persist each committed
phase transition and turn resolution. - Never store private selections
in public snapshots. - Avoid storing raw session credentials; store
hashes or use signed, expiring tokens.

### 8.3 Example role definition

``` json
{
  "id": "swordsman",
  "name": "Swordsman",
  "maxHp": 100,
  "baseAttack": 22,
  "skill": {
    "id": "blade_breaker",
    "name": "Blade Breaker",
    "usesPerDuel": 1,
    "damage": 32,
    "description": "Deal 32 damage once per duel."
  }
}
```

Treat the role definitions as server-owned configuration. A client may
receive public role statistics, but must not be allowed to submit a
modified role definition.

------------------------------------------------------------------------

## 9. API and Realtime Event Contract

The game is primarily real-time, so Socket.IO events form the main
interaction contract. A small REST API can support health checks, role
configuration, match creation, and results.

### 9.1 REST endpoints

  ----------------------------------------------------------------------------------
  Method            Endpoint                     Purpose           Access
  ----------------- ---------------------------- ----------------- -----------------
  `GET`             `/health`                    Health check      Public

  `GET`             `/api/roles`                 List enabled      Public
                                                 public roles      

  `POST`            `/api/matches`               Create a match    Host

  `GET`             `/api/matches/:id/public`    Public-safe match Public/room
                                                 snapshot          access

  `GET`             `/api/matches/:id/results`   Completed result  Host/authorized
                                                 summary           

  `POST`            `/api/matches/:id/reset`     Reset match       Host

  `POST`            `/api/matches/:id/pause`     Pause match       Host

  `POST`            `/api/matches/:id/resume`    Resume match      Host
  ----------------------------------------------------------------------------------

REST routes must validate match membership and role permissions. Do not
expose an endpoint that returns the full private match state to any
public caller.

### 9.2 Socket.IO client-to-server events

  ---------------------------------------------------------------------------------------------------
  Event                     Example payload                                   Description
  ------------------------- ------------------------------------------------- -----------------------
  `match:join`              `{ matchId, credential, view }`                   Join host, party, or
                                                                              arena view

  `match:ready`             `{ matchId }`                                     Mark party/host ready

  `pick:submit`             `{ matchId, duelNumber, fighterId }`              Submit or update
                                                                              selection before lock

  `pick:lock`               `{ matchId, duelNumber }`                         Lock current selection

  `action:submit`           `{ matchId, duelNumber, turnNumber, actionId }`   Select current combat
                                                                              action

  `action:lock`             `{ matchId, duelNumber, turnNumber }`             Lock action

  `host:pause`              `{ matchId, reason }`                             Pause active match

  `host:resume`             `{ matchId }`                                     Resume paused match

  `host:reset`              `{ matchId, confirmationToken }`                  Reset match

  `host:override`           `{ matchId, operation, reason }`                  Logged administrative
                                                                              action

  `match:requestSnapshot`   `{ matchId }`                                     Request authorized
                                                                              current state
  ---------------------------------------------------------------------------------------------------

Payloads are illustrative contracts. Define strict TypeScript DTOs and
validate them on the server.

### 9.3 Server-to-client events

  -------------------------------------------------------------------------
  Event                     Intended recipients     Data
  ------------------------- ----------------------- -----------------------
  `match:publicSnapshot`    All authorized views    Public-safe state only

  `party:privateSnapshot`   Members of that party   Own roster, own
                                                    eligibility, own locked
                                                    state

  `pick:locked`             Relevant party + host   Lock status only, not
                            status                  fighter identity

  `pick:revealed`           Both parties and arena  Both fighter identities
                                                    after both locks

  `action:locked`           Relevant party + host   Lock status only, not
                            status                  action

  `turn:resolved`           Both parties and arena  Public actions, damage,
                                                    HP, shield, effects

  `duel:completed`          Both parties and arena  Duel winner and result

  `match:completed`         All match views         Winner and series score

  `match:paused`            All match views         Pause status and public
                                                    reason

  `match:error`             Authorized initiating   Safe error code and
                            client                  message
  -------------------------------------------------------------------------

### 9.4 Hidden-information rules

-   Do not broadcast `fighterId` for an opponent's pick before reveal.
-   Do not broadcast an action identifier before both actions lock.
-   Do not include secrets in the public snapshot and expect the UI to
    hide them.
-   Use server-side authorization to decide which payload each
    connection receives.
-   Avoid logging private picks to publicly readable logs before reveal.
-   Ensure errors do not accidentally include hidden payloads.
-   Host access to private information should be deliberate and
    consistent with event rules. Recommended default: host sees only
    lock status until reveal, but can use an explicitly logged emergency
    override.

### 9.5 Example phase payload

``` json
{
  "matchId": "match_123",
  "phase": "pick",
  "duelNumber": 1,
  "seriesScore": {
    "A": 0,
    "B": 0
  },
  "selection": {
    "ownLocked": true,
    "opponentLocked": false,
    "deadlineAt": "2026-10-11T12:00:00.000Z"
  }
}
```

This payload is safe for a party view only if `ownLocked` and
`opponentLocked` are appropriate for that connection. It intentionally
does not include either fighter's selected identity.

------------------------------------------------------------------------

## 10. Security, Fairness, and Reliability

### 10.1 Server-authoritative game rules

The client is an input and display layer, not the source of truth. The
server owns: - Match phase. - Timers and deadlines. - Fighter
eligibility. - Selection lock state. - Action lock state. - HP, shield,
status effects, and skill uses. - Damage calculation. - Duel winner. -
Series score and match winner.

### 10.2 Authorization

-   Each party uses a distinct private session credential or
    authenticated session.
-   A Party A credential must not read or mutate Party B's private
    state.
-   Host operations require host authorization.
-   Arena access is read-only and receives public-safe data.
-   Credentials must be unguessable, expire appropriately, and not be
    embedded in public URLs where avoidable.
-   Do not rely on a client-provided `partySide` value as proof of
    identity.

### 10.3 Input validation

Validate: - Match and duel identifiers. - Phase and turn number. -
Fighter ownership and eligibility. - Allowed action IDs. - Skill-use
count. - Payload schema and size. - Lock state and duplicate
submissions. - Host permission for administrative commands.

### 10.4 Idempotency and race conditions

Socket clients may retry after a temporary network issue. The server
should: - Assign a command ID or use phase/turn identifiers. - Reject or
safely ignore duplicate lock commands. - Ensure a turn is resolved at
most once. - Commit the new state before emitting the result event. -
Use a per-match mutex/serialized command queue so two concurrent events
cannot resolve the same turn twice.

### 10.5 Timers

Timers must run on the server. The client may display a countdown based
on the server deadline, but it must not decide when a phase ends. On
reconnect, send the current deadline and phase state.

### 10.6 Logging and privacy

-   Record match lifecycle events and administrative overrides.
-   Avoid logging credentials or tokens.
-   Keep logs accessible only to authorized administrators.
-   Do not collect unnecessary personal information; display names are
    sufficient for the event.
-   Define a retention period for event results and logs.

------------------------------------------------------------------------

## 11. Non-Functional Requirements

### Performance

-   Public state changes should normally appear within 500 ms on a
    stable local or internet connection.
-   Combat resolution should complete quickly enough to feel immediate;
    target under 100 ms for domain calculations, excluding network
    latency and animations.
-   The MVP should comfortably support two parties, one host, and
    multiple spectator displays for a match.

### Availability and recovery

-   A host must be able to pause and resume.
-   A disconnected client must not reset the match.
-   The system must avoid resolving a turn twice.
-   For an event-critical deployment, provide a tested restart/recovery
    plan.

### Compatibility

-   Current desktop versions of Chrome, Edge, Firefox, and Safari.
-   Modern mobile Chrome and Safari.
-   Projector view should work at common 16:9 resolutions.

### Maintainability

-   Game rules are separated from UI code.
-   Shared event payloads use typed contracts.
-   Role values are configuration-driven.
-   Core combat rules have unit tests.
-   Rules changes require corresponding test updates.

### Accessibility

-   Keyboard-operable host controls.
-   High-contrast labels and HP indicators.
-   Reduced-motion support where practical.
-   Clear messages for errors, timeouts, and reconnecting state.

------------------------------------------------------------------------

## 12. Testing and Quality Assurance Plan

### 12.1 Unit tests

Test: - Damage calculations. - Guard reduction and rounding. - Shield
absorption. - Healing caps. - Skill-use limits. - Interrupt rules. -
Damage-over-time. - HP clamping. - Simultaneous defeat. - Turn-limit
resolution. - Series score and 2--0 early finish. - Fighter reuse
policy. - Timeout default actions.

### 12.2 Integration tests

Test: - Match creation with valid and invalid rosters. - Party
authorization boundaries. - Hidden pick behavior. - Reveal only after
both picks lock. - Hidden action behavior. - Turn resolution only
once. - Disconnect and reconnect. - Pause/resume. - Reset and next-match
state. - Host override audit records. - Match completion event and
result persistence.

### 12.3 End-to-end tests

1.  Host creates match.
2.  Both parties join.
3.  Both parties select different fighters.
4.  Party A locks; verify Party B and arena cannot see Party A's
    fighter.
5.  Party B locks; verify both picks reveal.
6.  Players choose actions; verify actions remain hidden until both
    lock.
7.  Resolve turns until a duel ends.
8.  Verify series score updates.
9.  Complete a 2--0 match and verify Duel 3 is skipped.
10. Complete a 1--1 series and verify Duel 3 starts.
11. Verify the final winner and reset flow.

### 12.4 Abuse and edge-case tests

-   Submit a fighter belonging to the opposing party.
-   Lock without a valid selection.
-   Change a selection after locking.
-   Submit an action for the wrong turn.
-   Submit a skill after its use is exhausted.
-   Send duplicate action-lock events.
-   Reconnect with an expired or wrong party credential.
-   Trigger a timeout at the same moment as a lock.
-   Disconnect both parties during a turn.
-   Attempt to view the opponent's private snapshot.
-   Reset during an active duel.
-   Try to start a new duel after the series is complete.

### 12.5 Event rehearsal checklist

-   Test the entire match on the actual venue Wi-Fi.
-   Test one mobile device for each party.
-   Test the host laptop and projector.
-   Confirm public arena is in the correct browser tab and full-screen.
-   Disable browser notifications on the host device.
-   Verify sound level and animation timing.
-   Practice pausing and resetting.
-   Confirm a backup plan if the venue network fails.
-   Run at least three complete test matches with different role
    combinations.
-   Confirm that all rules shown to players match the server
    implementation.

------------------------------------------------------------------------

## 13. Delivery Roadmap

### Phase 0 --- Rules freeze

Deliverables: - Final role pool. - Final skill descriptions. - Combat
priority order. - Timeout and tie rules. - Fighter reuse decision. -
Match settings and score rules.

Exit criteria: all stakeholders can explain one complete duel
consistently.

### Phase 1 --- Game engine

Deliverables: - Typed role definitions. - Combat state model. - Damage
and skill resolver. - Duel end rules. - Best-of-three controller. - Unit
tests.

Exit criteria: simulated matches resolve correctly without a frontend.

### Phase 2 --- Multiplayer protocol

Deliverables: - NestJS Socket.IO gateway. - Match creation and
joining. - Party authorization. - Hidden pick/lock/reveal. - Hidden
action/lock/reveal. - Timers and timeout policy. - Safe snapshots.

Exit criteria: two clients can play a complete match without exposing
private picks.

### Phase 3 --- Functional UI

Deliverables: - Host lobby. - Party control screens. - Public arena. -
Combat log and score. - Pause, resume, reset. - Basic reconnect
handling.

Exit criteria: a full match is playable in a browser.

### Phase 4 --- Lunar Night visual design

Deliverables: - Role illustrations/icons. - Midnight-indigo and
antique-gold design system. - Reveal transitions. - HP and shield
animations. - Victory screen and Lunar Relic. - Responsive and
projector-friendly layout.

Exit criteria: visuals improve clarity without delaying play.

### Phase 5 --- Rehearsal and launch

Deliverables: - End-to-end tests. - Venue rehearsal. - Match reset
workflow. - Error and recovery instructions. - Production environment
and health check. - Host quick-reference sheet.

Exit criteria: organizers can run a match without developer intervention
for normal cases.

------------------------------------------------------------------------

## 14. Risks and Mitigations

  -----------------------------------------------------------------------
  Risk                    Impact                  Mitigation
  ----------------------- ----------------------- -----------------------
  One role dominates      Match feels unfair      Playtest role matchups,
                                                  tune values, keep
                                                  server-driven
                                                  configuration

  Players do not          Slow turns              Short descriptions,
  understand skills                               tooltips, pre-match
                                                  role briefing

  Picks leak before       Competitive integrity   Authorized server-side
  reveal                  compromised             payloads; test public
                                                  and opponent snapshots

  Network drops during a  Delays or disputed      Server deadlines,
  turn                    result                  reconnect snapshots,
                                                  pause control

  Combat takes too long   Event schedule slips    Short turn timers,
                                                  max-turn rule,
                                                  automatic safe action

  Projector UI is too     Audience loses track    Large labels, limited
  dense                                           combat log, strong
                                                  score hierarchy

  Host accidentally       Lost progress           Confirmation dialog,
  resets match                                    clear reset warning,
                                                  audit log

  Rule interpretation     Disputes                Written rules,
  differs                                         deterministic
                                                  resolution order, host
                                                  quick guide

  Server restart loses    Match interrupted       Persist phase/turn
  live state                                      transitions or rehearse
                                                  restart recovery

  Duplicate events        Invalid HP/result       Serialized match
  resolve turn twice                              commands, idempotency,
                                                  turn-state checks
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 15. Open Decisions and Recommended Defaults

These items should be explicitly confirmed before final implementation.
The defaults below are recommended to keep the MVP moving.

  -----------------------------------------------------------------------
  Decision                            Recommended default
  ----------------------------------- -----------------------------------
  Initial role pool                   Five core roles, with expanded
                                      roles added after playtesting

  Role assignment                     Host-assigned or server-randomized,
                                      five distinct roles per party

  Repeated role in same party         Not allowed

  Fighter reuse in a series           Disabled by default

  Fighter selection timer             25 seconds

  Action timer                        12 seconds

  Timeout during selection            Random eligible fighter assigned
                                      server-side

  Timeout during combat               Guard selected automatically

  Maximum turns per duel              6

  Guard strength                      Reduce incoming basic Strike by 50%

  Skill use                           Usually once per duel

  Tie after turn limit                Remaining HP percentage, then
                                      shield, then sudden-death

  Host sees secret picks              Only after both sides lock, except
                                      logged emergency override

  Live state persistence              In-memory for a single-instance
                                      prototype; durable phase/turn
                                      storage for event-critical
                                      deployment

  Match history                       Store completed results; retain
                                      detailed logs only as needed

  Player identity                     Display names and short-lived party
                                      credentials; no full account system
                                      in MVP
  -----------------------------------------------------------------------

------------------------------------------------------------------------

## 16. Definition of Done

The MVP is ready for the event when:

-   [ ] A host can create and configure a match.
-   [ ] Two parties can join with five distinct fighters each.
-   [ ] Role assignment is validated.
-   [ ] Fighter picks remain secret until both sides lock.
-   [ ] Combat actions remain secret until both sides lock.
-   [ ] All combat calculations happen on the server.
-   [ ] Skills, shield, healing, interrupts, and turn limits behave
    according to the documented rules.
-   [ ] A duel winner is calculated deterministically.
-   [ ] The best-of-three series ends at 2 wins.
-   [ ] The third duel starts only when the series is 1--1.
-   [ ] The public arena displays the match without exposing private
    data.
-   [ ] Pause, resume, reset, timeout, and reconnect flows work.
-   [ ] Host overrides are logged.
-   [ ] Core engine and multiplayer protocol have automated tests.
-   [ ] The complete game has been rehearsed on the intended event
    devices and network.
-   [ ] The host has a short rules sheet and recovery checklist.

------------------------------------------------------------------------

## 17. Host Quick Reference

1.  Create a match and enter both party names.
2.  Confirm five distinct fighters for each party.
3.  Put the public arena on the projector.
4.  Give each party access to its private control screen.
5.  Start the match.
6.  During each pick phase, remind both parties to lock their choices
    before the timer ends.
7.  Wait for the simultaneous reveal.
8.  Players select and lock one action per turn.
9.  Let the server resolve the turn; do not manually calculate damage.
10. After a duel, confirm the score is correct.
11. Continue until one party reaches two duel wins.
12. Announce the winner and reset the arena for the next match.

### If something goes wrong

-   Pause the match first.
-   Do not ask players to refresh repeatedly before checking the current
    phase.
-   Reconnect the affected device and request the current authorized
    snapshot.
-   If a reset is necessary, confirm with the organizer because it
    clears active match progress.
-   Record any manual override and its reason.

------------------------------------------------------------------------

## 18. Glossary

-   **Party:** One team of five participants.
-   **Fighter:** A participant's in-game character and role.
-   **Role:** A class with defined stats and a unique skill.
-   **Duel:** One fighter from Party A versus one fighter from Party B.
-   **Series / Match:** The best-of-three set of duels between two
    parties.
-   **Pick phase:** The hidden fighter selection phase.
-   **Lock:** The irreversible submission of a choice for the current
    phase.
-   **Reveal:** The server-authorized public disclosure after both
    parties lock.
-   **Turn:** One simultaneous action choice from each active fighter.
-   **Arena:** The public display shown to spectators.
-   **Host:** The person operating the match and controlling
    administrative actions.
-   **Server-authoritative:** The server, not the browser, determines
    valid state and results.
-   **Lunar Relic:** The thematic symbol of victory.

------------------------------------------------------------------------

## 19. Final Product Direction

Build Lunar Dungeon as a **small, polished competitive game**, not a
large RPG. Its core value comes from secret selections, role matchups,
simultaneous action choices, clear combat rules, and the reveal on the
public arena screen.

The first implementation should prioritize correctness and fairness: 1.
Secret picks that cannot leak. 2. Deterministic combat resolution. 3.
Correct best-of-three progression. 4. Reliable host controls. 5. Clear
public display.

Once those pieces work, invest in role art, animation, sound, and the
Lunar Night atmosphere. A visually impressive game is useful only if the
live match remains fair, fast, and easy to operate.
