# Phase 4.4 — assessment types, scoring, and adaptive QA

Phase 4.4 extends the existing finalized-TOS workflow. It does not create a second assessment engine and it never lets AI recalculate TOS allocation.

## Stable contract

Each assessment contains exactly the finalized TOS slots `1..N`. The slot owns immutable competency, cognitive category, row/range mapping, and source-version snapshots. The assessment layer adds an independently editable question type, content, structured answer, `pointsPossible`, authorship/QA state, teacher notes, lock state, and a bounded five-entry item history.

The shared discriminated answer union supports:

1. Multiple Choice
2. True / False
3. Short Answer
4. Constructed Response
5. Identification
6. Fill in the Blank
7. Numerical Answer
8. Problem Solving / Show Your Solution
9. Matching Type
10. Multiple Select / Select All That Apply
11. Essay / Extended Response

Identification remains a separate teacher-facing type while reusing conservative accepted-text normalization. Fill blanks, matching responses, numerical tolerances/units, problem subparts, and rubrics remain structured—not concatenated into prose.

## Items and points

`totalItems` is the number of finalized TOS slots. Total possible points is derived from `sum(item.pointsPossible)` and is never independently allocated by Gemini. Missing legacy item points normalize to one; an explicitly invalid value is not silently converted.

When component scoring is enabled, every component must carry a positive point value and the sum must equal the item total:

- fill blanks;
- problem-solving subparts;
- matching responses or deterministic per-match/group allocation; and
- essay/constructed-response/problem rubrics.

Multiple Select uses all-or-nothing scoring. No negative marking or hidden penalty formula is introduced. An optional target total only reports the difference; it never silently changes item values.

## Mixed-format allocation

Teachers select the allowed type set. Disabled types are rejected by the UI/domain validator and authoritative save RPC. Optional auto-balanced, fixed-count, and percentage modes reconcile slot counts deterministically; manual-per-item preserves teacher choices. Distribution changes type and default points only—it does not change any TOS mapping.

## Mobile editing and item lifecycle

The editor mounts one complete type-specific item editor at a time and provides direct item navigation, Previous/Next, mapping badges, point controls, notes, QA status, lock/unlock, history, and restore. Material content/answer/type edits become teacher-edited and require answer recheck where appropriate. No AI request is spent merely because the teacher typed.

Generate Missing works only on empty or explicitly selected eligible items, skips locked/completed work, and persists successful candidates even if another item is cancelled, rate-limited, or fails. Replacement and alternatives operate on one item.

## Accuracy-first request flow

Every operation begins with deterministic structural validation. Low-risk generation normally stops after one request. Transparent risk signals—such as numerical/mathematical work, high cognitive demand, complex response types, high-point complex work, structural warnings, or an explicit teacher check—route the finished candidate to the other Flash-Lite model for independent structured verification.

Verification pass stops. Verification failure permits one targeted repair request for that immutable slot, followed by deterministic validation. The bounded workflow does not enter an unlimited repair loop; unresolved work becomes a teacher-review warning. Automatic fallback remains Lite-only.

The browser scheduler uses per-model queues, bounded concurrency, a configurable safety target below the product's approximate 15 requests/minute guidance, `Retry-After`/backoff handling, retry ceilings, cancellation, and approximate local-day request counters. Counters are informational and never claim to represent Google’s authoritative remaining quota.

## Final review and documents

Final review separates blocking structural/answer/points/TOS errors from quality warnings a teacher may consciously acknowledge. It derives coverage by both item count and possible points, checks duplicate prompts and suspicious patterns, and only routes selected risk items to optional AI review.

Student Copy excludes answers, TOS/AI/QA/internal metadata. Teacher Copy and the Answer Key/Scoring Guide are compiled from the stored structured answers, expected solutions, and rubrics; Gemini is never asked to solve the exported assessment.

## Persistence and compatibility

Migrations `017` and `018` are additive extensions. Migration `018` replaces the public save RPC with an authoritative typed/scoring contract, retains source-TOS ownership and mapping guards, protects locked rows, stores bounded history, derives total points, and creates one document version per save. Existing four-type and one-point assessments normalize safely without rewriting historical migrations.

