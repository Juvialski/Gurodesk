---
name: table-of-specifications-standards
description: >-
  Authoritative guide for Philippine DepEd Table of Specifications (TOS), item distribution algorithms
  (Hamilton / largest remainder), cognitive taxonomy allocation (Bloom's revised), and multi-format exports.
---

# DepEd Table of Specifications (TOS) Standards & Guide

This skill governs the generation, validation, cognitive distribution, and export formatting of Tables of Specifications (TOS) according to Philippine DepEd standards.

---

## 1. Cognitive Taxonomy Allocation (Revised Bloom's / DepEd Model)

A standard DepEd TOS organizes assessment items across 6 cognitive process dimensions:

| Category | Level | Standard Proportion | Typical Action Verbs |
| :--- | :--- | :--- | :--- |
| **Remembering** | Easy (Lower Order) | ~30% - 35% | Identify, define, list, recall, name, state |
| **Understanding** | Easy (Lower Order) | ~25% - 30% | Explain, describe, summarize, classify, convert |
| **Applying** | Average (Middle Order) | ~15% - 20% | Solve, calculate, demonstrate, apply, compute |
| **Analyzing** | Average (Middle Order) | ~10% - 15% | Compare, contrast, differentiate, analyze, examine |
| **Evaluating** | Difficult (Higher Order) | ~5% - 10% | Assess, judge, critique, justify, evaluate |
| **Creating** | Difficult (Higher Order) | ~5% - 10% | Design, construct, formulate, develop, propose |

### Standard DepEd Cognitive Splits
- **60% - 30% - 10% Rule**:
  - Easy (Remembering + Understanding): **60%**
  - Average (Applying + Analyzing): **30%**
  - Difficult (Evaluating + Creating): **10%**

---

## 2. Deterministic Item Distribution Algorithm (Hamilton / Largest Remainder)

When distributing $N$ test items across competencies weighted by days taught / weight percentage:
1. Compute exact fractional quota: $Q_i = N \times \frac{\text{Days}_i}{\text{Total Days}}$.
2. Assign the integer floor: $A_i = \lfloor Q_i \rfloor$.
3. Compute remainders: $R_i = Q_i - A_i$.
4. Sort competencies by descending remainder $R_i$ (breaking ties deterministically by competency order).
5. Distribute the remaining items $\left(N - \sum A_i\right)$ one by one to the competencies with the largest remainders.
6. The total allocated items must **exactly** equal $N$ with zero drift.

---

## 3. TOS Export Formats

Every finished TOS must export consistently across:
- **Excel (.xlsx)**: Clean tabular layout, formula-free raw values, proper cell alignment, and official DepEd header block.
- **Word (.docx)**: Table with bordered cells, header rows with `cantSplit` and `tblHeader`, landscape orientation where needed.
- **PDF**: Landscape auto-fit table with wrapped competency text and exact column totals.
