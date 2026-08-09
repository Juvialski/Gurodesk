# Phase 5 policy, privacy, and analytics boundaries

Last reviewed: 2026-08-09

## Official sources reviewed

- Department of Education, **DepEd Order No. 015, s. 2026 — Revised Guidelines on Classroom Assessment, Grading System, and Awards and Recognition for the K to 12 Basic Education Program**: <https://www.deped.gov.ph/wp-content/uploads/DO_s2026_015r.pdf>
- Department of Education official data privacy notice (division mirror of the DepEd notice): <https://bukidnon.deped.gov.ph/about/data-privacy-notice/>
- National Privacy Commission, **Implementing Rules and Regulations of the Data Privacy Act of 2012**: <https://privacy.gov.ph/implementing-rules-regulations-data-privacy-act-2012/>
- National Privacy Commission, **Data Privacy Foundational Course**: <https://privacy.gov.ph/data-privacy-foundational-course/>

The 2026 DepEd order is the current national classroom-assessment policy source for this implementation. Local school or division forms may add workflow conventions, but they are not treated as national requirements unless the national order says so.

## What Phase 5 treats as policy

- Classroom-assessment evidence is teacher-owned instructional information and must be handled consistently with the current DepEd assessment framework.
- The teacher remains responsible for assessment judgments, constructed-response scoring, interpretation, and instructional action.
- Learner information is personal data. Access is limited to the owning teacher in GuroDesk, with correction and predictable deletion/archive behavior.
- Processing follows transparency, legitimate purpose, and proportionality. GuroDesk collects only data needed to identify a learner inside the teacher's class and record assessment evidence.
- Personal data is not retained merely for an unspecified possible future use. GuroDesk does not invent a statutory retention period; schools remain responsible for applying their approved retention policy.

## What Phase 5 treats as mathematics, not DepEd policy

- Percentage correct (facility) is `number correct / number attempted` for items where correctness is meaningful. Omitted responses are reported separately.
- Point facility is `total points earned / total points available among attempted responses` and is named separately from percentage correct.
- Option distributions are deterministic counts and percentages. A distractor signal is advisory and never proves an item is defective.
- The discrimination statistic is a transparent item-rest correlation. For binary objective items this is the point-biserial/Pearson correlation between the 0/1 item score and the score on the rest of the assessment. Partial-point items use a separately labelled normalized item-rest Pearson correlation.
- Item-rest correlation is withheld for fewer than 10 usable learner records or zero-variance inputs. This is a GuroDesk sufficiency guard, not a DepEd cutoff.
- Average, median, minimum, maximum, and score distributions are descriptive statistics. Phase 5 creates no public learner ranking.

## Product defaults and teacher-configurable practice

- Difficulty labels and remediation thresholds are analytical conventions, not national mandates. Thresholds are teacher-configurable and reports identify them as teacher-selected/GuroDesk settings.
- Short-answer automatic scoring is off unless `normalized_exact` is explicitly enabled. Normalization is deliberately conservative: Unicode NFKC, surrounding-whitespace removal, internal-whitespace collapse, and optional case-folding only when the saved key is not case-sensitive. There is no semantic or AI matching.
- Score-only entry is permitted as a convenience but cannot produce item, distractor, competency-by-item, or cognitive-by-item analysis.
- Remediation groups are editable instructional signals. Neutral wording such as “Needs additional evidence/practice” is used; Phase 5 assigns no deficit or ability labels.

## Learner-data minimization

Required learner fields are limited to an internal UUID, owning teacher, teaching assignment, display name, and active/inactive state. A teacher-local reference is optional. Phase 5 does not require or provide fields for LRN, birth date, address, phone, email, guardian, health, disability/diagnosis, socioeconomic information, or learner passwords.

Result sessions take immutable snapshots of the finalized assessment, original item number, answer key, points, competency, cognitive category, curriculum period, and participating learner display identity. This preserves historical integrity when source assessments or curriculum data later change.

## Absolute AI boundary

Deterministic application code is authoritative for scoring and analysis. Gemini receives no learner name, learner UUID, local reference, LRN, raw response, answer sheet, learner feedback, or learner-level history.

Optional remediation suggestions may receive only an allow-listed aggregate payload: grade, learning area, verified competency, aggregate performance, number of learners needing additional practice, cognitive category, teacher-provided instructional constraints/resources/preferences, and language preference. The teacher must review and edit every suggestion. No AI output assigns points or changes analysis.

## Security and deletion boundary

- Every learner, result, participant, outcome, plan, and export/template relationship is checked against `auth.uid()` and the owning teaching assignment.
- Security-definer functions use a fixed safe `search_path`, derive the owner from `auth.uid()`, and reject cross-owner foreign keys.
- Results are saved in bounded batches; no request-per-answer loop is allowed.
- Draft result sessions may be deleted with their dependent outcomes. A learner with historical result participation is deactivated instead of silently destroying the historical snapshot.
- Final result snapshots are immutable except for controlled archive state. No grading/class-record, report-card, awards, or ranking computation is part of Phase 5.
