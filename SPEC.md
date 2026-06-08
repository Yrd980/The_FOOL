# The Fool Live Room Product Spec

## Product Promise

Run and watch an AI-native live show where non-human contestants compete,
perform, get judged, and leave behind a shared artifact the audience helped
shape.

The viewer should understand the room in under one minute:

```text
This is a live AI variety show.
The cast are non-human contestants.
They are trying to invent something together.
The audience can react, influence energy, and help shape the final artifact.
The show ends with winners, awards, a replayable story, and a souvenir.
```

## Primary User

The first target user is a creator or small community host who wants to run an
AI-native live event that is entertaining without requiring a production team.

Secondary users:

- viewers who want to watch strange AI performances
- communities that want participatory event formats
- AI builders who want to showcase agents as performers

The first product is not for enterprise workflow automation. It is for live
entertainment.

## Product Thesis

The Fool Live Room is not a video streaming platform and not a generic chat
room. It is a scripted live-room engine with a Phaser-rendered show surface.

The room engine owns truth. Phaser owns performance.

```text
RoomCommand -> RoomEvent -> RoomState -> LiveRoomSnapshot + ShowCue -> Phaser
```

This split is the core product contract:

- commands are validated actions
- events are immutable room facts
- state is the current truth
- snapshots are public show-safe state
- cues are presentation intent
- Phaser renders but does not decide

## The First Product

The first product is:

```text
The Fool: Non-Human Hackathon Live Room
```

It is a chaotic ceremonial AI variety show where non-human contestants invent
absurd projects, expose strange priorities, get judged by humans and AIs, and
co-create a final visual artifact.

The first version should prove one full show format before becoming a template
marketplace or generic room platform.

## MVP Scope

The MVP is one replayable, director-controlled live room for The Fool.

It must prove:

- a viewer opens `/room/:roomRunId` and immediately understands the show
- a director can run the full episode without engineering help
- the cast produces visible, entertaining moments
- act transitions feel staged, not like page changes
- submissions, judging, awards, and co-creation create a complete arc
- the final artifact is shareable

Defer:

- multi-template infrastructure beyond The Fool
- creator marketplace
- real-money voting or betting
- large-scale moderation systems
- complex payments
- generalized autonomous-agent sandbox behavior
- a full video streaming stack

## Retention Loop

The product should create a reason to return:

1. A viewer joins a live room.
2. They react, vote, prompt, or help co-create.
3. The show produces a result: winner capsule, award cards, replay, and canvas.
4. The result is shared.
5. New viewers join the next scheduled or host-run room.
6. Hosts run variants with new casts, prompts, and audience energy.

The shareable artifact is part of the product, not a nice-to-have.

## Show Format Bible

The show is a controlled-chaos variety format, not a process visualization.

### Host Role

The host protects rhythm and clarity.

The host should:

- introduce the premise
- frame each act
- call on cast members
- surface tension
- recap confusing moments
- decide when to hold, skip, or end a beat
- turn raw AI output into show moments
- close each act with a clear transition

### Contestant Role

Contestants should be strange, competitive, vulnerable, and memorable.

They are not generic chatbots. Each contestant needs:

- a visible identity
- a motivation
- a voice
- strengths and weaknesses
- relationships with other contestants
- recurring bits or callbacks

### Audience Role

The audience watches for:

- surprising personalities
- awkward team dynamics
- absurd inventions
- overconfident judging
- public reveal moments
- the final artifact

Audience input should change room energy often, show truth selectively, and
episode outcome only when the format explicitly allows it.

## Episode Structure

The first show has ten acts.

| Act | ID | Goal | Emotional Beat | Scene |
| --- | --- | --- | --- | --- |
| 1 | `act-1-intro` | reveal cast identity | spectacle, first impressions | `MainStageScene` |
| 2 | `act-2-preference` | expose motives and alliances | curiosity, suspicion | `MainStageScene` |
| 3 | `act-3-assignment` | create teams | social collision | `MainStageScene` |
| 4 | `act-4-discussion` | invent projects | creative mess, negotiation | `TeamRoomsScene` |
| 5 | `act-5-submission` | reveal project packages | pressure, commitment | `SubmissionShowcaseScene` |
| 6 | `act-6-human-review` | let humans react | taste-making, ridicule | `SubmissionShowcaseScene` |
| 7 | `act-7-ai-judging` | produce scores | judgment tension | `JudgingScene` |
| 8 | `act-8-awards` | turn results into ceremony | release, status | `AwardsScene` |
| 9 | `act-9-co-creation` | produce a shared artifact | communal weirdness | `CoCreationCanvasScene` |
| 10 | `act-10-open-mic` | close with callbacks | warmth, aftermath | `OpenMicScene` |

The pacing curve:

```text
entrance -> personality -> collision -> mess -> reveal -> judgment -> ceremony
-> shared artifact -> closeout
```

Not every act deserves the same production weight. The most important peaks are
Act 1, Act 5, Act 7, Act 8, and Act 9.

## Scene Grammar

Phaser needs a show language, not just rectangles on a canvas.

Reusable scene grammar:

- establishing shot: shows the room and current act
- cast close-up: focuses one performer
- spotlight monologue: isolates one statement
- team-room split screen: compares simultaneous teams
- submission pedestal: stages a project reveal
- judge table reaction: frames judgment as ceremony
- score drumroll: delays the score reveal
- award freeze-frame: makes awards collectible
- audience storm: visualizes reaction bursts
- canvas takeover: makes co-creation the whole room
- callback card: recalls an earlier line or moment

Information priority:

1. current act
2. speaking cast member or active reveal
3. subtitles/dialogue
4. room/team context
5. timer
6. audience energy
7. secondary logs and history

Every screen should read as a live event screenshot, not an admin app
screenshot.

## Visual Identity

The Fool should feel like a surreal game-show theater.

Visual rules:

- bright theatrical stage lighting
- strange backstage and team-room spaces
- distinct cast silhouettes
- broadcast-native overlays
- ritualized score reveals
- award cards that feel collectible
- the final canvas as the episode souvenir

Avoid:

- terminal-first layouts
- raw JSON views
- dashboard-first composition
- generic SaaS panels
- static document-style screens
- avatars that feel interchangeable

## Viewer Experience

Default route:

```text
/room/:roomRunId
```

The first screen is the show.

The viewer can:

- watch the current act
- read subtitles and dialogue
- see cast placement and teams
- react with lightweight bursts
- vote when the format allows
- submit prompts into a moderated queue when enabled
- help shape the Act 9 artifact
- share the result after the show

The viewer should never need backend logs, audit records, or operator output to
understand what is happening.

## Director Experience

The director is not merely an admin. The director protects taste, rhythm, and
clarity.

Director controls should include:

- start room
- advance act
- hold beat
- skip beat
- extend discussion
- spotlight cast member
- cut to team room
- trigger recap
- surface audience prompt
- send host broadcast
- open submission
- lock submission
- force submission reveal
- start score drumroll
- grant award
- mute or soft-hide bad output
- recover show state
- finish room

The director UI should be normal DOM application UI. Phaser is for the public
show surface.

## Audience Interaction Lanes

Audience interaction must be staged.

| Lane | Effect | Truth Impact |
| --- | --- | --- |
| React | creates visual energy bursts | no canonical outcome impact |
| Vote | advisory public signal | affects public summaries when enabled |
| Prompt | enters moderated queue | only affects room if director accepts |
| Boost | limited attention or energy effect | show-safe, format-gated |
| Co-create | contributes to final artifact | canonical only in Act 9 |
| Applaud | closure and social proof | visual/cue impact only |

Audience input should never overwhelm readability. The renderer should batch,
rate-limit, and stage reactions as bursts instead of raw chat spam.

## Core Product Contracts

### RoomRun

```ts
type RoomRunStatus =
  | "draft"
  | "live"
  | "paused"
  | "finishing"
  | "finished"
  | "archived";

interface RoomRun {
  id: string;
  templateId: string;
  status: RoomRunStatus;
  currentActId: string | null;
  startedAt?: number;
  finishedAt?: number;
}
```

### RoomCommand

A command is a requested mutation.

```ts
interface RoomCommand<TPayload = Record<string, unknown>> {
  id: string;
  roomRunId: string;
  actorId: string;
  actorRole: "director" | "host" | "cast" | "judge" | "audience" | "system";
  type: string;
  payload: TPayload;
  issuedAt: number;
  idempotencyKey?: string;
}
```

Every accepted command emits one or more `RoomEvent` records. Rejected commands
produce a director-visible error, not a public show fact.

### RoomEvent

An event is immutable room truth.

```ts
interface RoomEvent<TPayload = Record<string, unknown>> {
  id: string;
  roomRunId: string;
  sequence: number;
  type: string;
  actorId?: string;
  timestamp: number;
  payload: TPayload;
  sourceCommandId?: string;
}
```

Sequence numbers are strictly increasing within a room run. Refreshing the room
and replaying events must reconstruct the same public room state.

### LiveRoomSnapshot

The browser show surface consumes this public state.

```ts
interface LiveRoomSnapshot {
  version: 1;
  roomRun: RoomRun;
  scene: LiveRoomSceneState;
  cast: LiveRoomCastMember[];
  rooms: LiveRoomRoom[];
  teams: LiveRoomTeam[];
  dialogue: LiveRoomDialogueLine[];
  timers: LiveRoomTimer[];
  submissions: LiveRoomSubmissionCard[];
  scores: LiveRoomScoreBoard;
  awards: LiveRoomAward[];
  audience: LiveRoomAudienceState;
  canvas?: LiveRoomCanvasState;
  lastSequence: number;
}
```

The public snapshot must not include director secrets, hidden diagnostics,
private prompts, audit records, or internal health state.

### ShowCue

A show cue is presentation intent derived from events and state.

```ts
type ShowCue =
  | { id: string; sequence: number; type: "scene.transition"; actId: string }
  | { id: string; sequence: number; type: "dialogue.line"; actorId: string; text: string; roomId?: string }
  | { id: string; sequence: number; type: "cast.move"; actorId: string; roomId: string }
  | { id: string; sequence: number; type: "camera.focus"; targetId: string }
  | { id: string; sequence: number; type: "reaction.burst"; targetId: string; reaction: string; count: number }
  | { id: string; sequence: number; type: "submission.reveal"; submissionId: string }
  | { id: string; sequence: number; type: "score.reveal"; teamId: string; score: number }
  | { id: string; sequence: number; type: "award.reveal"; awardId: string; targetId: string }
  | { id: string; sequence: number; type: "canvas.stroke"; actorId: string; stroke: CanvasStroke };
```

Show cues are deduped by `id` and ordered by `sequence`. They may be replayed
without changing room truth.

## Public API Shape

Future product routes should be room-shaped:

```text
GET  /api/rooms/:roomRunId/snapshot
GET  /api/rooms/:roomRunId/events
GET  /api/rooms/:roomRunId/cues
POST /api/rooms/:roomRunId/commands
WS   /api/rooms/:roomRunId/live
```

## Director API Shape

Director routes expose operational control:

```text
POST /api/director/rooms
POST /api/director/rooms/:roomRunId/advance
POST /api/director/rooms/:roomRunId/broadcast
POST /api/director/rooms/:roomRunId/spotlight
POST /api/director/rooms/:roomRunId/open-submission
POST /api/director/rooms/:roomRunId/lock-submission
POST /api/director/rooms/:roomRunId/grant-award
POST /api/director/rooms/:roomRunId/finish
GET  /api/director/rooms/:roomRunId/audit
```

## Phaser Scenes

The public show should use Phaser scenes such as:

- `BootScene`
- `LiveRoomScene`
- `MainStageScene`
- `TeamRoomsScene`
- `SubmissionShowcaseScene`
- `JudgingScene`
- `AwardsScene`
- `CoCreationCanvasScene`
- `OpenMicScene`
- `TransitionScene`

Scene selection follows `roomRun.currentActId`.

Phaser may derive camera focus, animation timing, character poses, and visual
priority from show cues. Phaser must not decide current act, winner, score,
submission lock state, or room truth.

## Build Slices

Build vertically, not layer by layer.

1. Static show slice
   - `/room/:roomRunId` renders one act from a mocked `LiveRoomSnapshot`.
   - Acceptance: nonblank Phaser room, visible cast, readable act label.

2. Director transition slice
   - Director advances acts and the public show transitions.
   - Acceptance: `currentActId` changes, a `scene.transition` cue appears, and
     Phaser changes scene.

3. Dialogue and movement slice
   - Cast dialogue and room movement become event-backed.
   - Acceptance: refresh reconstructs the same visible dialogue and placement.

4. Submission reveal slice
   - Submissions open, lock, and reveal theatrically.
   - Acceptance: public snapshot shows show-safe submission cards, and reveal
     timing is cue-driven.

5. Judging and awards slice
   - Scores, winner, and awards become ceremony.
   - Acceptance: score reveals are staged, winner is visible, award cards are
     shareable.

6. Co-creation artifact slice
   - Act 9 produces a visible canvas artifact.
   - Acceptance: audience or cast actions create visible canvas changes and a
     final shareable image.

7. Replay/share slice
   - Finished rooms produce a replay and result capsule.
   - Acceptance: a finished room can be reopened, understood, and shared.

## Roadmap

| Phase | Product Reality | Still Fake Or Deferred |
| --- | --- | --- |
| 0 | static scripted Phaser demo | real commands, real AI, persistence |
| 1 | director-controlled room | AI cast autonomy, audience influence |
| 2 | event-backed room engine | advanced moderation, scale |
| 3 | AI cast participation | multi-template platform |
| 4 | audience reactions and co-creation | marketplace, payments |
| 5 | replay/share artifacts | full creator ecosystem |
| 6 | repeatable templates beyond The Fool | broad template marketplace |

Do not abstract into a template platform before The Fool is fun.

## Success Metrics

Product metrics:

- time to understand the room after opening `/room/:roomRunId`
- viewer retention through Act 3, Act 7, and Act 10
- audience interactions per room
- director completion rate for full runs
- share rate of result capsule, replay, or canvas artifact
- repeat room starts per host
- viewer-to-host conversion rate

Entertainment metrics:

- at least one surprising cast moment per run
- at least one audience action visibly changes the room
- at least one reveal feels timed rather than instant
- viewers can identify at least two cast members by role or personality
- the ending contains callbacks to earlier moments

## Acceptance Criteria

The first useful product build is accepted when:

- opening `/room/:roomRunId` shows a nonblank Phaser live room
- the room has a recognizable tone within 60 seconds
- a viewer can explain who the cast are and what act is happening
- dialogue appears as staged speech or subtitles
- director act transitions change the public scene
- cast placement is visible
- audience reactions produce controlled visual energy
- submissions, scores, awards, and winner can be shown
- at least one reveal is delayed and staged
- co-creation canvas has a visible final artifact
- finished room has a shareable result capsule
- refreshing the room reconstructs the same visible state
- replaying room events produces the same public state
- the browser show does not own product truth

## Non-Goals

The product is not:

- a video streaming platform
- a generic chat room
- a generic admin dashboard
- a terminal runtime
- an autonomous-agent sandbox as the first product
- a multi-template marketplace in v1
- a real-money voting or betting product
- a moderation platform in v1

This spec does not preserve:

- old CLI commands
- old ASCII watch
- old backend-first route names
- old backend-first documentation framing

## Risk Register

| Risk | Failure Mode | Product Rule |
| --- | --- | --- |
| Phaser owns truth | client state diverges from room state | Phaser renders only snapshots and cues |
| Director UI becomes product | show is a thin preview | `/room/:roomRunId` is always the primary experience |
| AI cast is dull | room feels like scripted logs | cast needs identity, motivation, and callbacks |
| Ten acts are too large | first build never becomes fun | ship vertical slices, not all systems |
| Audience spam hurts readability | show becomes unreadable | batch and stage audience input |
| Template abstraction arrives early | The Fool never gets good | keep one concrete show first |
| Cues are vague | duplicated frontend/backend logic | define cue ids, ordering, and replay behavior |

## Product Principle

Build the show first.

The backend exists so the live room has coherent truth. The frontend exists so
truth becomes performance. The product succeeds only when viewers want to watch
another room, not when the architecture is elegant.

