---
name: gemini-generation-standards
description: >-
  Authoritative engineering guide and contract specifications for Gemini AI generation, verification,
  and repair prompts across Edge Functions (Assessment Generator, Lesson Plan Generator, TOS Planner).
---

# Gemini Generation & Edge Function Standards

This skill defines the engineering boundaries, prompt architectures, and output contracts for all Google Gemini AI features in GuroDesk.

---

## 1. Official DepEd Policy & Teacher Primacy Boundary

- **Mandatory Policy Rule**: AI may draft content **only** subject to teacher validation, professional judgment, and curriculum alignment. AI must never claim to evaluate teacher performance, assign official school grades without teacher approval, or replace teacher judgment.
- **Reference**: DepEd Order No. 015, s. 2026 / Matatag Assessment Guidelines.
- **No Hallucinations**: Generators must never invent curriculum codes, official citations, real school PII, learner names, or unlisted resources.

---

## 2. Assessment Question Generation Contracts

Edge Function: `supabase/functions/assessment-question-generator/index.ts`

### A. All 11 Question Types — JSON Output Shapes

1. **`multiple_choice`**:
   - `{"type":"multiple_choice","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."},{"id":"D","text":"..."}],"choiceId":"A"}`
   - 3 to 5 plausible unique choices, exactly one correct `choiceId`.
2. **`true_false`**:
   - `{"type":"true_false","value":true}` (or `false`)
   - **LEARNER-PROMPT RULE**: Direct declarative statement only (e.g. *"The sum of angles in a triangle is 180°."*). **NEVER** include meta-instructions like *"Determine whether the following statement is true or false:"* or *"Analyze the following claim:"*.
3. **`short_answer`**:
   - `{"type":"short_answer","acceptedAnswers":["..."],"caseSensitive":false}`
   - **ANTI-ANSWER-LEAK RULE**: Never include any accepted answer string verbatim in the prompt, hints, parentheses, or examples.
4. **`identification`**:
   - `{"type":"identification","acceptedAnswers":["..."],"caseSensitive":false}`
   - **ANTI-ANSWER-LEAK RULE**: Describe distinguishing properties without naming any accepted answer in the stem.
5. **`fill_in_the_blank`**:
   - `{"type":"fill_in_the_blank","blanks":[{"id":"blank-1","acceptedAnswers":["..."]}]}`
   - Prompt must visibly mark blanks using `_____` or `[blank]`. Target answer must be hidden by the blank.
6. **`numerical_answer`**:
   - `{"type":"numerical_answer","value":12,"tolerance":0,"unit":"cm","requireUnit":true}`
   - `value` and `tolerance` must be finite numbers.
7. **`problem_solving`**:
   - `{"type":"problem_solving","finalAnswer":"...","solutionOutline":"..."}`
8. **`matching`**:
   - `{"type":"matching","prompts":[{"id":"p1","text":"..."}],"choices":[{"id":"A","text":"..."}],"mappings":[{"promptId":"p1","choiceId":"A"}],"reusableChoices":false}`
   - At least 2 prompts and unique choices.
9. **`multiple_select`**:
   - `{"type":"multiple_select","choices":[{"id":"A","text":"..."},{"id":"B","text":"..."},{"id":"C","text":"..."}],"choiceIds":["A","C"],"scoringPolicy":"all_or_nothing"}`
10. **`constructed_response`**:
    - `{"type":"constructed_response","expectedResponse":"...","sampleResponse":"..."}`
11. **`essay`**:
    - `{"type":"essay","keyPoints":["...","..."],"scoringNotes":"..."}`

---

## 3. Mathematical Notation & Formula Formatting

All mathematical expressions drafted by Gemini must use clean standard LaTeX notation:
- Exponents & Powers: `x^2`, `a^3 = b^2`, `10^5`
- Roots & Radicals: `\sqrt{a}`, `\sqrt[3]{b}`, `\sqrt[4]{x}`
- Units with Exponents: `cm^2`, `cm^3`, `m^2`
- Common Operators: `\times`, `\div`, `\pm`, `\approx`, `\le`, `\ge`

---

## 4. Visual Dependency & Diagram Contracts

- **`visualRequirement: "required"`**: The question stem must explicitly refer to the diagram/figure, and at least one essential numeric given, angle, or relationship needed to solve the problem must be absent from the text and present only in the diagram.
- **`visualRequirement: "helpful"`**: The question must be fully self-contained and answerable without the visual; the diagram only supports understanding without revealing the answer.
- **`visualRequirement: "none"`**: Pure text-only item; `visualIntent` must be empty string `""`.

---

## 5. Verification & Repair Lifecycle

Every generated item passes through:
1. **Candidate Verification (`buildVerifierPrompt`)**: Checks factual correctness, mathematical validity, competency alignment, and absence of answer leaks.
2. **Automated Targeted Repair (`buildRepairPrompt`)**: If verifier flags `needs_repair`, repair prompt preserves immutable TOS parameters (item number, competency, cognitive category, question type, points) while repairing the stem, answer, or visual intent.
