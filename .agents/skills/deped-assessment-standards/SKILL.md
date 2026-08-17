---
name: deped-assessment-standards
description: >-
  Authoritative guide and formatting rules for Philippine Department of Education (DepEd)
  assessments, question directions, typography, and student response layouts across all 11 question types.
---

# DepEd Assessment Standards & Formatting Guide

This skill defines the official formatting, typography, and structural conventions for assessments generated in GuroDesk according to Philippine Department of Education (DepEd) standards.

---

## 1. Universal Formatting Rules

### A. Section Directions
Every section heading must include standard bilingual directions (English or Filipino based on the assessment language).
- **Multiple Choice**:
  - *English*: `Directions: Read each question carefully. Choose the letter of the correct answer and write it on the space provided before each number.`
  - *Filipino*: `Panuto: Basahing mabuti ang bawat tanong. Piliin ang titik ng tamang sagot at isulat ito sa patlang bago ang bawat bilang.`
- **True or False**:
  - *English*: `Directions: Write TRUE if the statement is correct and FALSE if it is incorrect. Write your answer on the space provided before each number.`
  - *Filipino*: `Panuto: Isulat ang TAMA kung ang pahayag ay wasto at MALI kung ito ay hindi wasto. Isulat ang sagot sa patlang bago ang bilang.`
- **Identification**:
  - *English*: `Directions: Identify the term or concept being described in each statement. Write your answer on the space provided before each number.`
  - *Filipino*: `Panuto: Tukuyin ang konseptong inilalarawan sa bawat bilang. Isulat ang tamang sagot sa patlang bago ang bawat bilang.`
- **Matching Type**:
  - *English*: `Directions: Match the items in Column A with their corresponding descriptions in Column B. Write the letter of the correct answer on the space provided before each number in Column A.`
  - *Filipino*: `Panuto: Itambal ang mga pahayag sa Hanay A sa kanilang kaugnay na paglalarawan sa Hanay B. Isulat ang titik ng tamang sagot sa patlang bago ang bawat bilang sa Hanay A.`
- **Fill in the Blanks**:
  - *English*: `Directions: Fill in the blank(s) with the correct word or phrase to complete each statement.`
  - *Filipino*: `Panuto: Punan ang patlang ng tamang salita o parirala upang mabuo ang bawat pahayag.`
- **Short Answer**:
  - *English*: `Directions: Answer each question briefly and concisely on the space provided.`
  - *Filipino*: `Panuto: Sagutin nang maikli at tuwiran ang bawat katanungan sa nakalaang espasyo.`
- **Multiple Select**:
  - *English*: `Directions: Select ALL options that correctly answer the question. More than one choice may be correct.`
  - *Filipino*: `Panuto: Piliin ang LAHAT ng tamang sagot na tumutugon sa katanungan. Maaaring higit sa isa ang tamang sagot.`
- **Numerical Answer**:
  - *English*: `Directions: Solve each problem and write the final numerical value with its appropriate unit on the space provided.`
  - *Filipino*: `Panuto: Lutasin ang bawat suliranin at isulat ang tiyak na bilang at wastong yunit sa nakalaang espasyo.`
- **Problem Solving**:
  - *English*: `Directions: Read and solve each problem carefully. Show your complete solution on the space provided.`
  - *Filipino*: `Panuto: Basahin at lutasin ang bawat suliranin. Ipakita ang kumpletong solusyon sa nakalaang espasyo.`
- **Constructed Response**:
  - *English*: `Directions: Provide a well-reasoned and complete explanation for each question based on the given concept or data.`
  - *Filipino*: `Panuto: Magbigay ng komprehensibo at malinaw na paliwanag para sa bawat tanong batay sa ibinigay na konsepto.`
- **Essay**:
  - *English*: `Directions: Write a clear and well-organized essay addressing the prompt below. You will be evaluated on content, organization, and clarity of ideas.`
  - *Filipino*: `Panuto: Sumulat ng isang maayos at makabuluhang sanaysay batay sa paksa. Mamarkahan ang iyong gawa ayon sa nilalaman, organisasyon, at kalinawan ng kaisipan.`

---

## 2. Preceding Answer Blanks in Student Mode
In student copies, items that require writing a letter or word before the number must render with a 5-underscore blank:
- **Multiple Choice**: `_____ 1. What is the...`
- **True or False**: `_____ 1. The square root of...`
- **Identification**: `_____ 1. It is a polygon with...`

---

## 3. True/False Statement Cleanliness (Zero Meta-Redundancy)
- True/False questions must **NEVER** contain meta-instructions such as:
  - *"Determine whether the following statement is true or false:"*
  - *"Analyze the following statement:"*
  - *"Is this statement true or false?"*
  - *"Determine if this claim is True or False."*
- Prompts must be direct declarative statements to evaluate:
  - Correct: `The sum of the principal square root of 64 and the cube root of 27 is 11.`
  - Incorrect: `Determine whether the following statement is true or false: The sum of the principal square root of 64 and the cube root of 27 is 11.`

---

## 4. Typographic & Font Consistency Rules

To ensure clean, publication-ready output, question prompts, multiple-choice options, subparts, and blanks must share the **exact same font size**:
1. **Word (.docx)**:
   - Question Stem: `size: 20` (10pt)
   - Multiple Choice Choices: `size: 20` (10pt)
   - Subparts: `size: 20` (10pt)
   - Question Number Label: `size: 20` (10pt)
2. **Web Preview & Browser Print CSS**:
   - Question Stem: `12.5px`
   - Choice Row & Label: `12.5px`
   - Question Number Label: `12.5px`
3. **PDF Export**:
   - Question Stem: `9.5pt`
   - Choice List: `9.5pt`
   - Subparts: `9.5pt`

---

## 5. Math Text & Exponent Normalization Safety

- Powers must convert single variable powers (`a3 = b2` &rarr; `a³ = b²`) and measurement units (`50cm3` &rarr; `50cm³`, `10cm2` &rarr; `10cm²`).
- Subscripts must only attach to variables (`x_1` &rarr; `x₁`). Multi-underscore blanks (`_____ 1.`, `_____ 10.`) must **NEVER** convert numbers into subscripts.
