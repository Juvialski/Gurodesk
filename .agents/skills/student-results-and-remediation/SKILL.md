---
name: student-results-and-remediation
description: >-
  Architectural guide and privacy rules for student assessment scoring, item analysis,
  psychometric diagnostics (Facility & Discrimination index), and targeted competency-based remediation.
---

# Student Results, Item Analysis & Remediation Standards

This skill defines the privacy boundaries, psychometric calculation rules, and remediation pipelines for assessment scoring in GuroDesk.

---

## 1. Privacy & Roster Security Boundaries

- **Teacher-Only Learner Names**: Learner PII (first name, last name, LRN) is stored strictly in client-side / teacher-isolated tables protected by Row Level Security (RLS).
- **Zero Learner PII Sent to AI**: When requesting aggregate class analysis or remediation suggestions, learner names and identifiers are **never** passed to Gemini. Only anonymized item-level aggregate distributions and error patterns are processed.
- **Answer Sheet Batching**: Score saves and answer sheet submissions must be performed in atomic transactional batches to prevent partial writes or corrupted class totals.

---

## 2. Psychometric Item Analysis Calculations

Item statistics must be computed deterministically:

### A. Facility Index (Difficulty Level, $p$)
$$p = \frac{\text{Total Score on Item}}{\text{Maximum Possible Score on Item}}$$
- **$p \ge 0.75$**: Easy item (Mastered)
- **$0.25 \le p < 0.75$**: Moderate / Average item
- **$p < 0.25$**: Difficult item (Needs reinforcement)

### B. Discrimination Index ($D$)
Based on upper 27% ($U$) and lower 27% ($L$) student groups:
$$D = \frac{U_{\text{correct}} - L_{\text{correct}}}{n_{\text{group}}}$$
- **$D \ge 0.40$**: Excellent discrimination
- **$0.30 \le D < 0.40$**: Good discrimination
- **$0.20 \le D < 0.30$**: Marginal item (consider revising)
- **$D < 0.20$**: Poor item / Defective distractor (discard or revise)

### C. Distractor Efficiency Analysis
For multiple-choice items, each distractor must attract at least 5% of students and more students from the lower scoring group than the upper scoring group.

---

## 3. Grounded Remediation Architecture

Remediation plans generated for struggling competencies must:
1. Link directly to the official DepEd competency description and learning area.
2. Provide concrete, actionable classroom interventions (e.g. peer tutoring, visual re-teaching, concrete manipulatives, tiered practice worksheets).
3. Offer differentiated follow-up activities tailored to the specific error patterns detected in item analysis.
