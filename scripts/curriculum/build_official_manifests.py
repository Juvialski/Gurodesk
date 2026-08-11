#!/usr/bin/env python3
"""Build source-pinned GuroDesk curriculum manifests from official DepEd PDFs.

The generated JSON is intentionally the deployable artifact. Source PDFs are not
committed; this tool verifies their byte hashes and records page-level provenance.
It requires Python 3.11+ and pdfplumber 0.11+.
"""

from __future__ import annotations

import argparse
import difflib
import hashlib
import json
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote

import pdfplumber


RETRIEVED_ON = "2026-08-11"
K10_LANDING_PAGE = "https://bukidnon.deped.gov.ph/matatag-curriculum/"
SSHS_LANDING_PAGE = "https://www.deped.gov.ph/strengthened-shs-program/"
SSHS_LR_PORTAL = (
    "https://sites.google.com/deped.gov.ph/deped-lrportal/senior-high-school/"
    "strengthened-shs-program-you-are-herecurrentstrengthened-shs-program"
)

G12_FILE_IDS = {
    "Creative Production and Presentation.pdf": "1GSjS7KIllShguC73CgOdT2e4E2LSCCbE",
    "Advanced Mathematics.pdf": "1RcJS6dO_SQuWRo5oOQG3KQQ_EYU2mACJ",
    "Basic Calculus.pdf": "1MAvh4NdHcLyYGN7z5QnNB-PbXQ4Kd_yf",
    "Biology 3.pdf": "1iHjB-NDDwMMM6gU_JYU_9LrXjggZjoYA",
    "Biology 4.pdf": "1k0aovvNjBO24yJU7xx9GlYLe5CviTvTH",
    "Chemistry 3.pdf": "1C8m5YtFqluYhj5rPp_311abINxdFPBhy",
    "Chemistry 4.pdf": "1ubL-HENR0fLsObKh-kHTrYQh6ZdSJhwD",
    "Conceptual Biology and Earth and Space Science.pdf": "1kFqyKBvfSWGyXY9aqkQIoVpdyaGXFapr",
    "Conceptual Physics and Chemistry in Daily Life.pdf": "1DPTT5vnIZeKFzdBXI7TGWYXVyZpPZEY6",
    "Database Management.pdf": "1fMK14QLZCJR1SMmnjIw2RESpIkO44KgH",
    "Earth and Space Science 3.pdf": "1wKPQDoXNHPXOGZ7KfQdRADW6iyzcp1ds",
    "Earth and Space Science 4.pdf": "1j8XpAsdYOjP94p8f7I6CyW-D-9J4Raap",
    "Empowerment Technologies.pdf": "1fx-pDWpMqKz_izH2Ge3Dw3MiMO0siiNj",
    "Fundamentals of Data Analytics.pdf": "19LadJG6JAvtUP2W9iKZuh6eSa_a0gm1K",
    "Physics 3.pdf": "17fEIvS0nOmxYICkR9OkrNttnN1xfASUg",
    "Physics 4.pdf": "15I30c5m6zBK7HXHLyM438CRQrIxK7RLB",
    "Pre-Calculus.pdf": "1Vcikd2dpYlGw51dYMxdFGqIpbyTtVbRo",
    "Arts Apprenticeship - Dance.pdf": "1gC8r8HeQ2OR5KQ30J3hXi7nbvLhs8Uiu",
    "Arts Apprenticeship - Literary Arts.pdf": "1tqrHD4sTC6patd3cob439eSoah_vwK-2",
    "Arts Apprenticeship - Media Arts.pdf": "16lxlQSURg2_nhD0AiE2UDXD-PLkABnBj",
    "Arts Apprenticeship - Music.pdf": "13EBmV3zDa7Ie9GHtIp5gIxgwLbXEVnvC",
    "Arts Apprenticeship - Theater Arts.pdf": "1IT2vutKTJ01WEt9z2AFy1yLQcwn385CA",
}

K10_PACKS = {
    "FINAL MATATAG Kindergarten CG 2023.pdf": [("Kindergarten", "Kindergarten", None)],
    "FINAL MATATAG LANGUAGE CG 2023 Grade 1.pdf": [("Grade 1", "Language", None)],
    "FINAL MATATAG Reading and Literacy CG 2023 G1.pdf": [("Grade 1", "Reading and Literacy", None)],
    "FINAL MATATAG Makabansa CG 2023 Grades 1-3.pdf": [
        (f"Grade {grade}", "Makabansa", None) for grade in range(1, 4)
    ],
    "FINAL MATATAG Mathematics CG 2023 Grades 1-10.pdf": [
        (f"Grade {grade}", "Mathematics", None) for grade in range(1, 11)
    ],
    "FINAL MATATAG Science CG 2023 Grades 3-10.pdf": [
        (f"Grade {grade}", "Science", None) for grade in range(3, 11)
    ],
    "FINAL MATATAG English CG 2023 Grades 2-10 (withAppendices).pdf": [
        (f"Grade {grade}", "English", None) for grade in range(2, 11)
    ],
    "FINAL MATATAG FILIPINO CG 2023 Grades 2-10.pdf": [
        (f"Grade {grade}", "Filipino", None) for grade in range(2, 11)
    ],
    "FINAL MATATAG Araling Panlipunan CG 2023 Grades 4-10.pdf": [
        (f"Grade {grade}", "Araling Panlipunan", None) for grade in range(4, 11)
    ],
    "FINAL MATATAG Music and Arts CG 2023 Grades 4-10.pdf": [
        (f"Grade {grade}", "MAPEH", "Music and Arts") for grade in range(4, 11)
    ],
    "FINAL MATATAG PE and Health CG 2023 Grades 4-10.pdf": [
        (f"Grade {grade}", "MAPEH", "Physical Education and Health") for grade in range(4, 11)
    ],
    "FINAL MATATAG EPP_TLE CG 2023 Grades 4 - 10.pdf": [
        *[(f"Grade {grade}", "EPP", None) for grade in range(4, 7)],
        *[(f"Grade {grade}", "TLE", None) for grade in range(7, 11)],
    ],
    "FINAL MATATAG GMRC and VE CG 2023 Grades 1-10.pdf": [
        *[(f"Grade {grade}", "GMRC", None) for grade in range(1, 7)],
        *[(f"Grade {grade}", "Values Education", None) for grade in range(7, 11)],
    ],
}

K10_CONTENT_START_PAGES = {
    "FINAL MATATAG Kindergarten CG 2023.pdf": 18,
    "FINAL MATATAG LANGUAGE CG 2023 Grade 1.pdf": 36,
    "FINAL MATATAG Reading and Literacy CG 2023 G1.pdf": 36,
    "FINAL MATATAG Makabansa CG 2023 Grades 1-3.pdf": 16,
    "FINAL MATATAG Mathematics CG 2023 Grades 1-10.pdf": 25,
    "FINAL MATATAG Science CG 2023 Grades 3-10.pdf": 29,
    "FINAL MATATAG English CG 2023 Grades 2-10 (withAppendices).pdf": 47,
    "FINAL MATATAG FILIPINO CG 2023 Grades 2-10.pdf": 21,
    "FINAL MATATAG Araling Panlipunan CG 2023 Grades 4-10.pdf": 16,
    "FINAL MATATAG Music and Arts CG 2023 Grades 4-10.pdf": 30,
    "FINAL MATATAG PE and Health CG 2023 Grades 4-10.pdf": 21,
    "FINAL MATATAG EPP_TLE CG 2023 Grades 4 - 10.pdf": 29,
    "FINAL MATATAG GMRC and VE CG 2023 Grades 1-10.pdf": 32,
}

FILIPINO_ORDINALS = {
    "UNANG": 1,
    "IKALAWANG": 2,
    "IKATLONG": 3,
    "IKAAPAT": 4,
}
GRADE_ORDINALS = {
    "UNA": 1,
    "IKALAWA": 2,
    "IKATLO": 3,
    "IKAAPAT": 4,
    "IKALIMA": 5,
    "IKAANIM": 6,
    "IKAPITO": 7,
    "IKAWALO": 8,
    "IKASIYAM": 9,
    "IKASAMPUNG": 10,
}
ENGLISH_ORDINALS = {"FIRST": 1, "SECOND": 2, "THIRD": 3, "FOURTH": 4}
ROMAN_PERIODS = {"I": 1, "II": 2, "III": 3, "IV": 4}

LC_LABELS = ("LEARNING COMPETENC", "LEARNING STANDARD", "KASANAYANG PAMPAGKATUTO")
DOMAIN_LABELS = ("CONTENT DOMAIN", "SUBDOMAIN", "SUB-DOMEYN", "NILALAMAN", "CONTENT")
TABLE_EXCLUSIONS = (
    "CONTENT STANDARD",
    "PERFORMANCE STANDARD",
    "SUGGESTED PERFORMANCE",
    "SUGGESTED COMMUNICATIVE",
    "SUGGESTED LEARNING",
)
CODE_PATTERN = re.compile(r"(?<![A-Z0-9])([A-Z]{1,12}\d[A-Z0-9-]*-[IVX]+-\d+(?:\.\d+)*)\s+(.+)")
NUMBER_PATTERN = re.compile(r"(?<![\d.])(\d{1,3})\.\s*(?=[^\d.])")
PLAIN_NUMBER_PATTERN = re.compile(r"(?<![\d.])(\d{1,3})(?:\.|\s+)\s*(?=[^\d.])")
FILIPINO_INTERNAL_COMPETENCY_PATTERN = re.compile(
    r"(?<!\([a-z]\))(?<![a-z][.)]) "
    r"(?=(?:Nababasa|Nabibigkas|Nabibigyang(?:-kahulugan)?|Nagagamit|Naibabahagi|Naibibigay|"
    r"Naiiba|Naiisa-isa|Nailalarawan|Naipaliliwanag|Naisusulat|Naiuugnay|Nakabubuo|Nakabubuod|"
    r"Nakapagbubuod|Nakapagpapahayag|Nakasusulat|Nakikilala|Nakilala|Napaghahambing|Nasasagutan|"
    r"Nasusuri|Natutukoy|Nauunawaan)\b)"
)
FILIPINO_PUBLISHED_SUMMARY_COUNTS = {
    2: [24, 24, 23, 23],
    3: [21, 21, 21, 22],
    4: [18, 18, 18, 18],
    5: [20, 20, 20, 20],
    6: [19, 19, 19, 19],
    7: [7, 7, 7, 7],
    8: [7, 7, 7, 6],
    9: [7, 7, 6, 5],
    10: [5, 6, 4, 5],
}


def clean_text(value: str | None) -> str:
    text = unicodedata.normalize("NFC", value or "")
    text = text.replace("\u00ad", "").replace("\uf0b7", "•")
    text = re.sub(r"(?<=\w)-\s*\n\s*(?=\w)", "-", text)
    text = re.sub(
        r"(?<!\w)(?:[^\W\d_]\s+){4,}[^\W\d_](?!\w)",
        lambda match: re.sub(r"\s+", "", match.group(0)),
        text,
    )
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"(?<=\w)\s*-\s*(?=\w)", "-", text)
    text = re.sub(r"\s+([,.;:!?])", r"\1", text)
    return text


def normalized(value: str) -> str:
    value = unicodedata.normalize("NFKD", value)
    value = "".join(char for char in value if not unicodedata.combining(char))
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def slugify(value: str) -> str:
    return normalized(value).replace(" ", "-")


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for block in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def roman_or_number(value: str) -> int | None:
    value = value.upper().strip()
    if value.isdigit() and 1 <= int(value) <= 4:
        return int(value)
    return ROMAN_PERIODS.get(value)


def line_markers(text: str) -> tuple[list[int] | None, list[int] | None]:
    """Return explicit grades and periods found in a single visual line."""
    upper = clean_text(text).upper().replace("—", "–")
    if "CURRICULUM:" in upper or "GRADES " in upper or "BAITANG 2-10" in upper:
        return None, None
    if re.match(r"^(?:GRADE|BAITANG)\s+\d{1,2}\s*[-–]\s*\d{1,2}$", upper):
        return [-1], None

    grades: list[int] | None = None
    periods: list[int] | None = None

    match = re.match(
        r"^(?:GRADE|BAITANG)\s+(\d{1,2})(?:\s+OR\s+(\d{1,2}))?"
        r"(?:\s*[–-]\s*(?:(?:QUARTER\b.*)|(?:(?:FIRST|SECOND|THIRD|FOURTH)\s+QUARTER\b.*)|(?:(?:UNANG|IKALAWANG|IKATLONG|IKAAPAT)(?:\s+NA)?\s+MARKAHAN\b.*)))?$",
        upper,
    )
    if match:
        grades = [int(match.group(1))]
        if match.group(2):
            grades.append(int(match.group(2)))
    else:
        match = re.match(
            r"^(UNA|IKALAWA|IKATLO|IKAAPAT|IKALIMA|IKAANIM|IKAPITO|IKAWALO|IKASIYAM|IKASAMPUNG)(?:NG)?\s+(?:NA\s+)?BAITANG$",
            upper,
        )
        if match:
            key = match.group(1)
            grades = [GRADE_ORDINALS[key]]

    numeric = re.search(r"\bQUARTER\s*([1-4]|I{1,3}|IV)(?:\s*/\s*([1-4]|I{1,3}|IV))?\b", upper)
    if numeric:
        periods = [roman_or_number(numeric.group(1))]
        if numeric.group(2):
            periods.append(roman_or_number(numeric.group(2)))
        periods = [value for value in periods if value is not None]
    else:
        english = re.search(r"\b(FIRST|SECOND|THIRD|FOURTH)\s+QUARTER\b", upper)
        filipino = re.search(r"\b(UNANG|IKALAWANG|IKATLONG|IKAAPAT)(?:\s+NA)?\s+MARKAHAN\b", upper)
        theme = re.search(r"\bTHEME\s+(I{1,3}|IV)\b", upper)
        if english:
            periods = [ENGLISH_ORDINALS[english.group(1)]]
        elif filipino:
            periods = [FILIPINO_ORDINALS[filipino.group(1)]]
        elif theme:
            periods = [ROMAN_PERIODS[theme.group(1)]]

    return grades, periods


def table_text(table: Any) -> str:
    return " ".join(clean_text(cell) for row in table.extract() for cell in row if clean_text(cell))


def band_overlap(cell: tuple[float, float, float, float], band: tuple[float, float]) -> bool:
    center = (cell[0] + cell[2]) / 2
    return band[0] - 1.5 <= center <= band[1] + 1.5


def cell_is_emphasized(page: Any, cell: tuple[float, float, float, float]) -> bool:
    chars = [char for char in page.crop(cell).chars if not char.get("text", "").isspace()]
    if not chars:
        return False
    emphasized = sum(
        1 for char in chars if "bold" in char.get("fontname", "").lower() or "italic" in char.get("fontname", "").lower()
    )
    return emphasized / len(chars) >= 0.65


def domain_name(value: str, fallback: str) -> str:
    lines = [clean_text(line) for line in (value or "").splitlines() if clean_text(line)]
    kept: list[str] = []
    for line in lines:
        if kept and re.match(r"^(?:[•●▪]|\d+[.)]|[a-z][.)])\s*", line, flags=re.I):
            break
        kept.append(line)
        if sum(len(item) for item in kept) > 180:
            break
    candidate = clean_text(" ".join(kept)) if kept else fallback
    candidate = re.sub(r"^(?:\d+|[IVX]+)[.)]\s*", "", candidate, flags=re.I)
    candidate = re.sub(r"^[•●▪]\s*", "", candidate)
    if len(candidate) > 180:
        candidate = re.split(r"[;:]", candidate, maxsplit=1)[0][:180].rstrip()
    return candidate or fallback


def clean_domain_label(value: str) -> str:
    label = clean_text(value) or "General"
    words = label.split()
    if len(words) % 2 == 0:
        midpoint = len(words) // 2
        if normalized(" ".join(words[:midpoint])) == normalized(" ".join(words[midpoint:])):
            label = " ".join(words[:midpoint])
    return label


@dataclass
class RawRow:
    grades: tuple[int, ...]
    periods: tuple[int, ...]
    page: int
    text: str
    domain: str
    emphasized: bool


@dataclass
class RawStandard:
    grades: tuple[int, ...]
    periods: tuple[int, ...]
    page: int
    text: str


@dataclass
class ExtractedDocument:
    rows: list[RawRow] = field(default_factory=list)
    standards: list[RawStandard] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)


def find_header_band(page: Any, table: Any, labels: Iterable[str]) -> tuple[tuple[float, float], float] | None:
    values = table.extract()
    for row_index, row in enumerate(table.rows):
        for cell, value in zip(row.cells, values[row_index]):
            if not cell:
                continue
            upper = clean_text(value).upper()
            if any(label in upper for label in labels):
                return (cell[0], cell[2]), cell[3]
    return None


def extract_document(
    path: Path,
    fixed_grades: tuple[int, ...] | None = None,
    default_periods: tuple[int, ...] = (),
    start_page: int = 1,
) -> ExtractedDocument:
    result = ExtractedDocument()
    active_grades = fixed_grades or ()
    active_periods: tuple[int, ...] = default_periods
    max_grade_seen = max(active_grades, default=-1)
    curriculum_started = bool(active_grades and active_periods)
    last_lc_band: tuple[float, float] | None = None
    last_domain_band: tuple[float, float] | None = None
    current_domain: dict[tuple[tuple[int, ...], tuple[int, ...]], str] = {}
    active_sector = ""
    use_sector_context = "EPP_TLE" in path.name
    seen_rows: set[tuple[int, str, tuple[int, ...], tuple[int, ...]]] = set()

    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            if page_number < start_page:
                continue
            try:
                visual_lines = page.extract_text_lines() or []
            except Exception as error:  # pragma: no cover - malformed-font fallback
                visual_lines = []
                result.warnings.append(f"page {page_number}: marker extraction failed: {error}")
            page_lines = [clean_text(line.get("text", "")) for line in visual_lines if clean_text(line.get("text", ""))]
            if any(
                re.search(r"(?:BILANG|NUMBER)\s+NG?\s*(?:MGA\s+)?(?:LEARNING\s+)?KASANAYANG\s+PAMPAGKATUTO|NUMBER\s+OF\s+LEARNING\s+COMPETENC", line, flags=re.I)
                for line in page_lines[:12]
            ):
                continue
            if use_sector_context:
                for line in page_lines[:20]:
                    sector_match = re.match(r"^SECTOR\s*:\s*(.+)$", line, flags=re.I)
                    if sector_match:
                        active_sector = clean_text(sector_match.group(1))
                        break
            if result.rows and any(
                re.match(r"^(?:APPENDIX|GLOSSARY|GLOSARI|REFERENCES|BIBLIOGRAPHY|MGA SANGGUNIAN)\b", line, flags=re.I)
                for line in page_lines[:12]
            ):
                break
            events: list[tuple[float, list[int] | None, list[int] | None]] = []
            for line in visual_lines:
                grades, periods = line_markers(line.get("text", ""))
                if grades or periods:
                    events.append((float(line.get("top", 0)), grades, periods))

            events.sort(key=lambda item: item[0])
            event_index = 0

            def state_at(y: float) -> tuple[tuple[int, ...], tuple[int, ...]]:
                nonlocal event_index, active_grades, active_periods, max_grade_seen, curriculum_started
                while event_index < len(events) and events[event_index][0] <= y:
                    _, grades, periods = events[event_index]
                    if grades and fixed_grades is None:
                        if grades == [-1]:
                            active_grades = ()
                        elif not curriculum_started or min(grades) >= max_grade_seen:
                            active_grades = tuple(grades)
                    if periods:
                        active_periods = tuple(periods)
                        if active_grades:
                            curriculum_started = True
                            max_grade_seen = max(max_grade_seen, max(active_grades))
                    event_index += 1
                return active_grades, active_periods

            found_tables = [table for table in page.find_tables() if table.bbox[2] - table.bbox[0] >= page.width * 0.35]
            # pdfplumber can report a bordered competency table and additional
            # one-column tables nested inside individual multi-line cells. The
            # enclosing table already contains the complete source text; parsing
            # nested tables as peers would create partial duplicate competencies.
            tables = [
                table
                for table in found_tables
                if not any(
                    other is not table
                    and other.bbox[0] <= table.bbox[0]
                    and other.bbox[1] <= table.bbox[1]
                    and other.bbox[2] >= table.bbox[2]
                    and other.bbox[3] >= table.bbox[3]
                    and (other.bbox[2] - other.bbox[0]) * (other.bbox[3] - other.bbox[1])
                    > (table.bbox[2] - table.bbox[0]) * (table.bbox[3] - table.bbox[1])
                    for other in found_tables
                )
            ]
            for table in sorted(tables, key=lambda item: item.bbox[1]):
                grades, periods = state_at(table.bbox[1])
                raw_table_text = table_text(table).upper()
                lc_header = find_header_band(page, table, LC_LABELS)
                has_exclusion = any(label in raw_table_text for label in TABLE_EXCLUSIONS)

                if lc_header:
                    lc_band, header_bottom = lc_header
                    last_lc_band = (lc_band[0] / page.width, lc_band[1] / page.width)
                elif last_lc_band and not has_exclusion:
                    lc_band = (last_lc_band[0] * page.width, last_lc_band[1] * page.width)
                    header_bottom = table.bbox[1] - 1
                else:
                    continue

                # Domain headers must be aligned with or above the learning-competency header.
                # This prevents data such as "content-specific words" from being mistaken for
                # a CONTENT column header on continuation pages.
                candidates: list[tuple[float, float]] = []
                values = table.extract()
                for row_index, row in enumerate(table.rows):
                    for cell, value in zip(row.cells, values[row_index]):
                        if not cell or cell[1] > header_bottom + 1.5:
                            continue
                        upper = clean_text(value).upper()
                        if (
                            any(upper.startswith(label) and len(upper) < len(label) + 36 for label in DOMAIN_LABELS)
                            and "STANDARD" not in upper
                        ):
                            candidates.append((cell[0], cell[2]))
                if candidates:
                    d_band = min(candidates, key=lambda item: item[0])
                    last_domain_band = (d_band[0] / page.width, d_band[1] / page.width)
                elif lc_header:
                    d_band = None
                    last_domain_band = None
                elif last_domain_band:
                    d_band = (last_domain_band[0] * page.width, last_domain_band[1] * page.width)
                else:
                    d_band = None

                values = table.extract()
                for row_index, row in enumerate(table.rows):
                    row_top = min((cell[1] for cell in row.cells if cell), default=table.bbox[1])
                    if row_top + 0.5 < header_bottom:
                        continue
                    grades, periods = state_at(row_top)
                    if not grades or not periods:
                        continue

                    domain_parts: list[str] = []
                    learning_parts: list[tuple[float, str, tuple[float, float, float, float]]] = []
                    for cell, value in zip(row.cells, values[row_index]):
                        if not cell or not clean_text(value):
                            continue
                        text = clean_text(value)
                        upper = text.upper()
                        if any(upper.startswith(label) and len(upper) < len(label) + 30 for label in LC_LABELS):
                            continue
                        if d_band and band_overlap(cell, d_band) and "STANDARD" not in upper:
                            domain_parts.append(value or "")
                        if band_overlap(cell, lc_band):
                            learning_parts.append((cell[0], value or "", cell))

                    if domain_parts:
                        name = domain_name("\n".join(domain_parts), "General")
                        if active_sector:
                            name = f"{active_sector}: {name}"
                        current_domain[(grades, periods)] = name

                    if not learning_parts:
                        continue
                    learning_parts.sort(key=lambda item: item[0])
                    joined_parts: list[str] = []
                    for _, value, _ in learning_parts:
                        clean = clean_text(value)
                        if clean.isdigit():
                            joined_parts.append(f"{clean}.")
                        else:
                            joined_parts.append(clean)
                    text = clean_text(" ".join(joined_parts))
                    upper = text.upper()
                    if not text or any(upper.startswith(label) and len(upper) < len(label) + 30 for label in LC_LABELS):
                        continue
                    if upper.startswith("THE LEARNERS") and len(upper) < 48:
                        continue
                    if any(upper.startswith(label) for label in TABLE_EXCLUSIONS):
                        continue

                    spanning = len(learning_parts) == 1 and (
                        learning_parts[0][2][0] < lc_band[0] - 10 or learning_parts[0][2][2] > lc_band[1] + 10
                    )
                    emphasized = cell_is_emphasized(page, learning_parts[0][2])
                    if (
                        (spanning or d_band is None)
                        and emphasized
                        and not NUMBER_PATTERN.search(text)
                        and not CODE_PATTERN.search(text)
                        and not (" FILIPINO " in f" {path.name} " and is_filipino_competency_start(text))
                    ):
                        name = domain_name(text, "General")
                        current_domain[(grades, periods)] = f"{active_sector}: {name}" if active_sector else name
                        continue

                    key = (page_number, normalized(text), grades, periods)
                    if key in seen_rows:
                        continue
                    seen_rows.add(key)
                    result.rows.append(
                        RawRow(
                            grades=grades,
                            periods=periods,
                            page=page_number,
                            text=text,
                            domain=current_domain.get((grades, periods), "General"),
                            emphasized=emphasized,
                        )
                    )

            # Apply markers below the final table so state carries to the next page.
            state_at(float("inf"))

    return result


def append_text(existing: str, addition: str) -> str:
    addition = clean_text(addition)
    if not addition:
        return existing
    if not existing:
        return addition
    return clean_text(f"{existing} {addition}")


def clean_competency(value: str) -> str:
    text = clean_text(value)
    text = re.split(r"\bNOTE(?:\s+FOR\s+IMPLEMENTATION)?\s*:", text, maxsplit=1, flags=re.I)[0]
    text = re.sub(r"\bduring the during the\b", "during the", text, flags=re.I)
    text = re.sub(r"\band hair and hair\b", "and hair", text, flags=re.I)
    # A few PDFs expose the source row number inside a duplicated text layer.
    # Drop a leading row number and collapse only prefix-equivalent fragments,
    # retaining whichever side contains the more complete source wording.
    text = re.sub(r"^\d{1,3}\.\s+", "", text)
    while True:
        embedded_number = re.search(r"\s+\d{1,3}\.\s+", text)
        if not embedded_number:
            break
        left = clean_text(text[: embedded_number.start()])
        right = clean_text(text[embedded_number.end() :])
        left_tokens = normalized(left).split()
        right_tokens = normalized(right).split()
        shorter = min(len(left_tokens), len(right_tokens))
        if shorter < 4 or left_tokens[:shorter] != right_tokens[:shorter]:
            break
        text = left if len(left_tokens) >= len(right_tokens) else right
    text = clean_text(text)
    while True:
        tokens = list(re.finditer(r"[\w’'-]+", text.lower()))
        duplicate: tuple[int, int] | None = None
        for size in range(min(40, len(tokens) // 2), 4, -1):
            for index in range(len(tokens) - 2 * size + 1):
                left = [token.group(0) for token in tokens[index : index + size]]
                right = [token.group(0) for token in tokens[index + size : index + 2 * size]]
                if left == right:
                    duplicate = (tokens[index + size].start(), tokens[index + 2 * size - 1].end())
                    break
            if duplicate:
                break
        if not duplicate:
            return text
        text = clean_text(f"{text[:duplicate[0]]} {text[duplicate[1]:]}")


def repair_mathematics_competency(text: str, source_page: int) -> str:
    """Repair glyphs whose embedded PDF font maps superscripts/fractions to punctuation."""
    if source_page == 28 and text.startswith("illustrate and as parts of a whole"):
        return "illustrate 1/2 and 1/4 as parts of a whole."
    if source_page == 28 and text.startswith("compare and using models"):
        return "compare 1/2 and 1/4 using models."
    if source_page == 48 and text.startswith("divide:"):
        return (
            "divide: a. 1- to 2-digit whole numbers resulting in a repeating (non-terminating) decimal quotient "
            "(e.g., 1/3 = 0.3333…), and b. a whole number by a decimal of 1 decimal place."
        )
    if source_page == 51 and text.startswith("solve problems involving GCF and LCM."):
        return "solve problems involving GCF and LCM."
    return text.replace('"', "²").replace("$", "³").replace("#", "⁴")


def is_continuation(current: dict[str, Any] | None, row: RawRow) -> bool:
    if not current or row.page > int(current["sourcePage"]) + 1:
        return False
    previous = clean_text(current.get("text", ""))
    addition = clean_text(row.text)
    if not previous or not addition:
        return False
    if re.match(r"^(?:[a-z][.)]|[•●▪]|and\b|or\b|at\b|o\b)", addition):
        return True
    if previous.endswith("-"):
        return True
    return addition[0].islower() and not re.search(r"[.;!?]$", previous)


def is_filipino_competency_start(value: str) -> bool:
    text = clean_text(value)
    return len(text) > 1 and text[0] == "N" and text[1].islower()


def parse_rows(
    rows: list[RawRow],
    target_grade: int,
    period: int,
    mode_override: str | None = None,
) -> list[dict[str, Any]]:
    global_numeric = mode_override == "numeric_global"
    selected = [
        row
        for row in rows
        if target_grade in row.grades
        and (global_numeric or period in row.periods)
    ]
    if not selected:
        return []

    has_codes = any(CODE_PATTERN.search(row.text) for row in selected)
    number_pattern = PLAIN_NUMBER_PATTERN if mode_override == "numeric_plain" else NUMBER_PATTERN
    numeric_markers = sum(len(number_pattern.findall(row.text)) for row in selected)
    regular_rows = sum(1 for row in selected if not row.emphasized)
    mode = "numeric" if global_numeric else mode_override or ("coded" if has_codes else "numeric" if numeric_markers >= 2 else "unnumbered")
    if not mode_override and numeric_markers == 1 and regular_rows <= 3:
        mode = "numeric"

    records: list[dict[str, Any]] = []
    current: dict[str, Any] | None = None

    if mode == "coded":
        for row in selected:
            matches = list(CODE_PATTERN.finditer(row.text))
            if not matches:
                if not row.emphasized and is_continuation(current, row):
                    current["text"] = append_text(current["text"], row.text)
                continue
            prefix = row.text[: matches[0].start()]
            if current and clean_text(prefix):
                current["text"] = append_text(current["text"], prefix)
            for index, match in enumerate(matches):
                end = matches[index + 1].start() if index + 1 < len(matches) else len(row.text)
                text = clean_competency(row.text[match.start(2) : end])
                current = {
                    "competencyCode": match.group(1),
                    "text": text,
                    "sourcePage": row.page,
                    "domainName": row.domain,
                }
                records.append(current)
        return records

    if mode in {"numeric", "numeric_plain"}:
        expected = 1
        sequence_domain: str | None = None
        for row in selected:
            markers = list(number_pattern.finditer(row.text))
            accepted: list[re.Match[str]] = []
            for marker in markers:
                number = int(marker.group(1))
                if mode_override == "numeric_plain" and number == 1 and row.domain != sequence_domain and expected != 1:
                    expected = 1
                if number == expected:
                    accepted.append(marker)
                    expected += 1
                    sequence_domain = row.domain
            if not accepted:
                if not row.emphasized and is_continuation(current, row):
                    current["text"] = append_text(current["text"], row.text)
                continue
            prefix = row.text[: accepted[0].start()]
            if current and clean_text(prefix):
                current["text"] = append_text(current["text"], prefix)
            for index, marker in enumerate(accepted):
                end = accepted[index + 1].start() if index + 1 < len(accepted) else len(row.text)
                text = clean_competency(row.text[marker.end() : end])
                current = {
                    "competencyCode": None,
                    "text": text,
                    "sourcePage": row.page,
                    "domainName": row.domain,
                    "sourceSequence": int(marker.group(1)),
                    **({"_sourcePeriod": row.periods[0]} if global_numeric else {}),
                }
                records.append(current)
        if global_numeric:
            records = [record for record in records if record.pop("_sourcePeriod") == period]
        return records

    for row in selected:
        if row.emphasized and not (
            mode_override == "unnumbered" and is_filipino_competency_start(row.text)
        ):
            continue
        text = clean_competency(row.text)
        if is_continuation(current, row) or (
            mode_override == "unnumbered"
            and current is not None
            and not is_filipino_competency_start(text)
        ):
            current["text"] = append_text(current["text"], text)
            continue
        if len(text) < 12:
            continue
        current = {
            "competencyCode": None,
            "text": text,
            "sourcePage": row.page,
            "domainName": row.domain,
        }
        records.append(current)
    # Some Filipino quarter-opening pages expose content/performance standard
    # blocks through the same visual column as the competency table. They are
    # always the leading one or two records, before the first competency row.
    # Retain standards out of band rather than misclassifying them as learning
    # competencies; later rows can legitimately inherit an unusable standard
    # label as their fallback domain, so only the leading block is removed.
    for _ in range(2):
        if not records or not re.search(
            r"(?:PAMANTAYANG PANGNILALAMAN|PAMANTAYAN SA PAGGANAP|CONTENT STANDARD|PERFORMANCE STANDARD)",
            records[0]["domainName"],
            flags=re.I,
        ):
            break
        records.pop(0)
    if mode_override == "unnumbered":
        split_records: list[dict[str, Any]] = []
        for record in records:
            parts = [clean_text(part) for part in FILIPINO_INTERNAL_COMPETENCY_PATTERN.split(record["text"])]
            split_records.extend({**record, "text": part} for part in parts if part)
        records = split_records
    return records


def make_manifest(
    pack: dict[str, Any],
    source: dict[str, Any],
    extracted: ExtractedDocument,
) -> dict[str, Any]:
    grade_number = int(re.search(r"\d+", pack["gradeLevel"]).group()) if pack["gradeLevel"] != "Kindergarten" else 0
    period_type = "term" if pack["gradeLevel"] in {"Kindergarten", "Grade 12"} else "quarter"
    competencies: list[dict[str, Any]] = []
    domain_order: list[str] = []
    domain_names: dict[str, str] = {}
    periods: list[dict[str, Any]] = []

    for period in range(1, 5):
        records = parse_rows(extracted.rows, grade_number, period, pack.get("extractionMode"))
        if not records:
            continue
        periods.append(
            {
                "label": (
                    f"Theme {['I', 'II', 'III', 'IV'][period - 1]}"
                    if pack["gradeLevel"] == "Kindergarten"
                    else f"Term {period}"
                    if pack["gradeLevel"] == "Grade 12"
                    else f"Quarter {period}"
                ),
                "sequence": period,
                "periodType": period_type,
                "sourcePage": min(record["sourcePage"] for record in records),
            }
        )
        for order, record in enumerate(records, 1):
            record["text"] = clean_competency(record["text"])
            if " Mathematics " in f" {source['fileName']} ":
                record["text"] = repair_mathematics_competency(record["text"], record["sourcePage"])
            name = clean_domain_label(record.pop("domainName") or "General")
            if re.search(
                r"(?:CONTENT STANDARD|PERFORMANCE STANDARD|PAMANTAYANG PANGNILALAMAN|PAMANTAYAN SA PAGGANAP)",
                name,
                flags=re.I,
            ):
                name = "General"
            domain_key = normalized(name)
            if domain_key not in domain_names:
                domain_names[domain_key] = name
                domain_order.append(domain_key)
            record.pop("sourceSequence", None)
            competencies.append(
                {
                    "recordId": f"{pack['slug']}:period-{period}:item-{order}",
                    "quarter": period,
                    "domain": "",  # assigned after deterministic domain coding
                    "sortOrder": order,
                    **record,
                    "verificationStatus": "verified",
                    "_domainKey": domain_key,
                }
            )

    prefix = ""
    if pack.get("component") == "Music and Arts":
        prefix = "MA"
    elif pack.get("component") == "Physical Education and Health":
        prefix = "PH"
    domains = []
    domain_codes: dict[str, str] = {}
    for index, domain_key in enumerate(domain_order, 1):
        code = f"{prefix + '-' if prefix else ''}D{index:02d}"
        domain_codes[domain_key] = code
        domains.append({"code": code, "name": domain_names[domain_key], "sortOrder": index})
    for competency in competencies:
        competency["domain"] = domain_codes[competency.pop("_domainKey")]

    if not competencies:
        raise ValueError(
            f"No competencies extracted for {pack['slug']} from {source['fileName']}"
        )

    source_file_name = source["fileName"]
    filipino_periods = any(
        token in source_file_name
        for token in ("FILIPINO", "Araling Panlipunan", "GMRC and VE", "Makabansa")
    )
    pe_periods = "PE and Health" in source_file_name
    roman_periods = "EPP_TLE" in source_file_name
    for item in periods:
        sequence = item["sequence"]
        if pack["gradeLevel"] == "Kindergarten":
            item["sourceLabel"] = f"Theme {['I', 'II', 'III', 'IV'][sequence - 1]}"
        elif pack["gradeLevel"] == "Grade 12":
            item["sourceLabel"] = "One term"
        elif filipino_periods:
            item["sourceLabel"] = ["Unang Markahan", "Ikalawang Markahan", "Ikatlong Markahan", "Ikaapat na Markahan"][sequence - 1]
        elif pe_periods:
            item["sourceLabel"] = f"{['First', 'Second', 'Third', 'Fourth'][sequence - 1]} Quarter"
        elif roman_periods:
            item["sourceLabel"] = f"Quarter {['I', 'II', 'III', 'IV'][sequence - 1]}"
        else:
            item["sourceLabel"] = f"Quarter {sequence}"

    curriculum_code = pack["curriculumCode"]
    if curriculum_code == "REVISED-K10-MATATAG":
        curriculum_name = "Revised K to 10 / MATATAG Curriculum"
        framework = "Revised K to 10 Curriculum"
        start_year = {
            "Kindergarten": "2024-2025",
            "Grade 1": "2024-2025",
            "Grade 2": "2025-2026",
            "Grade 3": "2025-2026",
            "Grade 4": "2024-2025",
            "Grade 5": "2025-2026",
            "Grade 6": "2026-2027",
            "Grade 7": "2024-2025",
            "Grade 8": "2025-2026",
            "Grade 9": "2026-2027",
            "Grade 10": "2026-2027",
        }[pack["gradeLevel"]]
        all_years = ["2024-2025", "2025-2026", "2026-2027"]
        applicability_years = all_years[all_years.index(start_year) :]
        implementation = "full"
    else:
        curriculum_name = "Strengthened Senior High School Curriculum"
        framework = "Strengthened Senior High School Program"
        start_year = "2026-2027"
        applicability_years = ["2026-2027"]
        implementation = "pilot" if pack["gradeLevel"] == "Grade 12" else "full"

    title_subject = pack["learningArea"]
    if pack.get("component"):
        title_subject = f"{title_subject} — {pack['component']}"

    manifest = {
        "schemaVersion": 2,
        "slug": pack["slug"],
        "verification": {
            "status": "verified",
            "verifiedOn": RETRIEVED_ON,
            "method": "deterministic table extraction with structural source checks",
            "notes": (
                "Competency text is transcribed from the pinned official source file. "
                "Whitespace is normalized; source wording, codes, sequence, period, and PDF page provenance are retained."
            ),
        },
        "source": {
            "sourceType": "curriculum_guide",
            "title": source["title"],
            "issuanceCode": None,
            "sourceUrl": source["sourceUrl"],
            "landingPageUrl": source["landingPageUrl"],
            "publishedOn": None,
            "edition": source.get("edition"),
            "publisher": "Department of Education",
            "fileName": source["fileName"],
            "fileId": source["fileId"],
            "sha256": source["sha256"],
            "byteSize": source["byteSize"],
            "pageCount": source["pageCount"],
            "pagesUsed": {
                "from": min(competency["sourcePage"] for competency in competencies),
                "to": max(competency["sourcePage"] for competency in competencies),
            },
            "retrievedOn": source["retrievedOn"],
        },
        "curriculumVersion": {
            "code": curriculum_code,
            "name": curriculum_name,
            "framework": framework,
            "effectiveFromSchoolYear": start_year,
            "effectiveToSchoolYear": None,
            "status": "active",
            "implementationNotes": (
                "Official source sequence is preserved as curriculum quarters/themes; school grading-period mapping remains separate."
            ),
        },
        "applicability": [
            {
                "schoolYear": year,
                "gradeLevel": pack["gradeLevel"],
                "implementationStatus": implementation,
                "priority": 10,
                "notes": "Official DepEd implementation coverage.",
            }
            for year in applicability_years
        ],
        "subject": {
            "gradeLevel": pack["gradeLevel"],
            "code": f"{slugify(pack['learningArea']).upper()[:18]}{grade_number or 'K'}",
            "name": pack["learningArea"],
            "description": f"Official {pack['gradeLevel']} {title_subject} competency records.",
            **({"component": pack["component"]} if pack.get("component") else {}),
        },
        "periods": periods,
        "domains": domains,
        "performanceStandards": [],
        "competencies": competencies,
    }
    if " FILIPINO " in f" {source_file_name} ":
        detailed_counts = [
            sum(competency["quarter"] == period for competency in competencies)
            for period in range(1, 5)
        ]
        published_counts = FILIPINO_PUBLISHED_SUMMARY_COUNTS[grade_number]
        manifest["verification"]["sourceConsistency"] = {
            "detailedTableCountsByQuarter": detailed_counts,
            "publishedSummaryCountsByQuarter": published_counts,
            "status": "matched" if detailed_counts == published_counts else "official_source_variance",
            "resolution": (
                "The detailed quarter tables are authoritative for row-level transcription. "
                "Where the guide's final summary table differs, every detailed competency row is retained and the variance is explicit."
            ),
        }
    integrity_payload = json.dumps(
        {
            "slug": manifest["slug"],
            "sourceSha256": manifest["source"]["sha256"],
            "periods": manifest["periods"],
            "domains": manifest["domains"],
            "competencies": manifest["competencies"],
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    manifest["integrity"] = {
        "extractorVersion": "official-curriculum-v1",
        "normalization": "Unicode NFC; whitespace normalized; source wording retained",
        "competencyPayloadSha256": hashlib.sha256(integrity_payload).hexdigest(),
    }
    return manifest


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--catalog", type=Path, default=Path("data/curriculum/sources/catalog-snapshot.json"))
    parser.add_argument("--k10-metadata", type=Path, required=True)
    parser.add_argument("--sshs-index", type=Path, required=True)
    parser.add_argument("--output-dir", type=Path, default=Path("data/curriculum/official"))
    parser.add_argument("--register", type=Path, default=Path("data/curriculum/sources/official-source-register.json"))
    parser.add_argument("--pack-index", type=Path, default=Path("data/curriculum/sources/official-pack-index.json"))
    parser.add_argument("--write", action="store_true")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    catalog = json.loads(args.catalog.read_text(encoding="utf-8"))
    catalog_entries = catalog["entries"]
    current_by_grade = defaultdict(list)
    for entry in catalog_entries:
        current_by_grade[entry["gradeLevel"]].append(entry)

    k10_meta_raw = json.loads(args.k10_metadata.read_text(encoding="utf-8"))
    k10_meta = {item["Name"]: item for item in k10_meta_raw["value"]}
    sshs_ids = {}
    for line in args.sshs_index.read_text(encoding="utf-8").splitlines():
        file_id, file_name = line.split("\t", 1)
        if "SHAPE-PAPER" not in file_name:
            sshs_ids[file_name] = file_id

    sources: list[dict[str, Any]] = []
    source_paths: dict[str, Path] = {}

    for file_name in sorted(K10_PACKS):
        path = args.source_root / "k10" / file_name
        if not path.is_file():
            raise FileNotFoundError(path)
        meta = k10_meta[file_name]
        server_path = meta["ServerRelativeUrl"]
        parent = str(Path(server_path).parent).replace("\\", "/")
        source_url = (
            "https://depedph-my.sharepoint.com/personal/ouct_deped_gov_ph/_layouts/15/onedrive.aspx"
            f"?id={quote(server_path, safe='')}&parent={quote(parent, safe='')}"
        )
        with pdfplumber.open(path) as pdf:
            page_count = len(pdf.pages)
        source_id = f"k10-{slugify(file_name.removesuffix('.pdf').replace('FINAL MATATAG ', ''))}"
        source = {
            "id": source_id,
            "family": "revised_k10",
            "title": file_name.removesuffix(".pdf").replace("FINAL ", ""),
            "fileName": file_name,
            "fileId": server_path,
            "sourceUrl": source_url,
            "landingPageUrl": K10_LANDING_PAGE,
            "edition": "August 2023",
            "sha256": sha256(path),
            "byteSize": path.stat().st_size,
            "pageCount": page_count,
            "retrievedOn": RETRIEVED_ON,
        }
        sources.append(source)
        source_paths[source_id] = path

    def closest_subject(file_name: str, grade_level: str) -> dict[str, Any]:
        stem = Path(file_name).stem
        stem = re.sub(r"(?:-a_o-Jun-9|\s*\(1\)|_)+", " ", stem, flags=re.I)
        candidates = current_by_grade[grade_level]
        scores = []
        for entry in candidates:
            score = difflib.SequenceMatcher(None, normalized(stem), normalized(entry["learningArea"])).ratio()
            scores.append((score, entry))
        score, entry = max(scores, key=lambda item: item[0])
        if score < 0.64:
            raise ValueError(f"No reliable catalog match for {file_name}: {score:.3f} -> {entry['learningArea']}")
        return entry

    sshs_file_lookup = {normalized(name): (name, file_id) for name, file_id in sshs_ids.items()}
    for path in sorted((args.source_root / "sshs").glob("*.pdf")):
        key = normalized(path.name)
        if key not in sshs_file_lookup:
            raise ValueError(f"Missing Grade 11 file ID for {path.name}")
        original_name, file_id = sshs_file_lookup[key]
        entry = closest_subject(path.name, "Grade 11")
        with pdfplumber.open(path) as pdf:
            page_count = len(pdf.pages)
        source_id = f"sshs-g11-{slugify(entry['learningArea'])}"
        source = {
            "id": source_id,
            "family": "strengthened_shs_grade11",
            "title": f"Strengthened SHS Curriculum Guide: {entry['learningArea']}",
            "fileName": original_name,
            "fileId": file_id,
            "sourceUrl": f"https://drive.google.com/file/d/{file_id}/view",
            "landingPageUrl": SSHS_LR_PORTAL,
            "edition": "Strengthened SHS",
            "sha256": sha256(path),
            "byteSize": path.stat().st_size,
            "pageCount": page_count,
            "retrievedOn": RETRIEVED_ON,
        }
        sources.append(source)
        source_paths[source_id] = path

    for path in sorted((args.source_root / "g12").glob("*.pdf")):
        file_id = G12_FILE_IDS[path.name]
        entry = closest_subject(path.name, "Grade 12")
        with pdfplumber.open(path) as pdf:
            page_count = len(pdf.pages)
        source_id = f"sshs-g12-{slugify(entry['learningArea'])}"
        source = {
            "id": source_id,
            "family": "strengthened_shs_grade12",
            "title": f"Strengthened SHS Curriculum Guide: {entry['learningArea']}",
            "fileName": path.name,
            "fileId": file_id,
            "sourceUrl": f"https://drive.google.com/file/d/{file_id}/view",
            "landingPageUrl": SSHS_LANDING_PAGE,
            "edition": "Strengthened SHS",
            "sha256": sha256(path),
            "byteSize": path.stat().st_size,
            "pageCount": page_count,
            "retrievedOn": RETRIEVED_ON,
        }
        sources.append(source)
        source_paths[source_id] = path

    sources_by_id = {source["id"]: source for source in sources}
    packs: list[dict[str, Any]] = []

    k10_source_by_file = {source["fileName"]: source for source in sources if source["family"] == "revised_k10"}
    catalog_by_key = {(entry["gradeLevel"], entry["learningArea"]): entry for entry in catalog_entries}
    for file_name, pack_specs in K10_PACKS.items():
        source = k10_source_by_file[file_name]
        for grade_level, learning_area, component in pack_specs:
            entry = catalog_by_key[(grade_level, learning_area)]
            suffix = f"-{slugify(component)}" if component else ""
            packs.append(
                {
                    "catalogId": entry["id"],
                    "curriculumCode": entry["curriculumCode"],
                    "gradeLevel": grade_level,
                    "learningArea": learning_area,
                    "component": component,
                    "sourceId": source["id"],
                    "extractionMode": (
                        "numeric_global"
                        if grade_level == "Kindergarten"
                        else "coded"
                        if any(token in file_name for token in (" English ", " LANGUAGE ", "Reading and Literacy"))
                        else "unnumbered"
                        if " FILIPINO " in file_name
                        else "numeric_plain"
                        if " EPP_TLE " in file_name
                        else "numeric"
                    ),
                    "slug": f"revised-k10-{slugify(grade_level)}-{slugify(learning_area)}{suffix}",
                }
            )

    for source in sources:
        if not source["family"].startswith("strengthened_shs"):
            continue
        grade_level = "Grade 12" if source["family"].endswith("grade12") else "Grade 11"
        entry = closest_subject(source["fileName"], grade_level)
        packs.append(
            {
                "catalogId": entry["id"],
                "curriculumCode": entry["curriculumCode"],
                "gradeLevel": grade_level,
                "learningArea": entry["learningArea"],
                "component": None,
                "sourceId": source["id"],
                "extractionMode": None,
                "slug": f"sshs-{slugify(grade_level)}-{slugify(entry['learningArea'])}",
            }
        )

    mapped_catalog_ids = {pack["catalogId"] for pack in packs}
    expected_catalog_ids = {entry["id"] for entry in catalog_entries}
    if mapped_catalog_ids != expected_catalog_ids:
        missing = sorted(expected_catalog_ids - mapped_catalog_ids)
        extra = sorted(mapped_catalog_ids - expected_catalog_ids)
        raise ValueError(f"Pack/catalog mismatch: missing={missing}, extra={extra}")

    manifests: list[tuple[dict[str, Any], dict[str, Any]]] = []
    packs_by_source: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for pack in packs:
        packs_by_source[pack["sourceId"]].append(pack)

    for source_id, source_packs in sorted(packs_by_source.items()):
        source = sources_by_id[source_id]
        fixed = None
        if source["family"] == "strengthened_shs_grade11":
            fixed = (11,)
        elif source["family"] == "strengthened_shs_grade12":
            fixed = (12,)
        elif source["fileName"] in {
            "FINAL MATATAG Kindergarten CG 2023.pdf",
            "FINAL MATATAG LANGUAGE CG 2023 Grade 1.pdf",
            "FINAL MATATAG Reading and Literacy CG 2023 G1.pdf",
        }:
            fixed = (0,) if "Kindergarten" in source["fileName"] else (1,)
        default_periods = (1,) if source["family"].startswith("strengthened_shs") else ()
        extracted = extract_document(
            source_paths[source_id],
            fixed,
            default_periods,
            K10_CONTENT_START_PAGES.get(source["fileName"], 1),
        )
        for pack in source_packs:
            manifest = make_manifest(pack, source, extracted)
            if not manifest["competencies"]:
                raise ValueError(f"No competencies extracted for {pack['slug']} from {source['fileName']}")
            manifests.append((pack, manifest))
        warning_count = len(extracted.warnings)
        print(
            f"extract {source['fileName']}: {len(extracted.rows)} candidate rows, "
            f"{len(source_packs)} pack(s), {warning_count} warning(s)"
        )

    register = {
        "schemaVersion": 1,
        "retrievedOn": RETRIEVED_ON,
        "sourceCount": len(sources),
        "totalBytes": sum(source["byteSize"] for source in sources),
        "sources": sorted(sources, key=lambda item: item["id"]),
    }
    index = {
        "schemaVersion": 1,
        "catalogEntryCount": len(expected_catalog_ids),
        "manifestCount": len(packs),
        "note": "MAPEH catalog entries intentionally map to separate Music and Arts and Physical Education and Health source manifests.",
        "packs": sorted(packs, key=lambda item: item["slug"]),
    }

    total_competencies = sum(len(manifest["competencies"]) for _, manifest in manifests)
    print(
        f"ready: {len(sources)} pinned sources, {len(packs)} manifests, "
        f"{len(expected_catalog_ids)} catalog entries, {total_competencies} competencies"
    )

    if args.write:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        args.register.parent.mkdir(parents=True, exist_ok=True)
        for stale in args.output_dir.glob("*.json"):
            stale.unlink()
        args.register.write_text(json.dumps(register, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        args.pack_index.write_text(json.dumps(index, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        for pack, manifest in manifests:
            output = args.output_dir / f"{pack['slug']}.json"
            output.write_text(json.dumps(manifest, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
        print(f"wrote manifests to {args.output_dir}")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as error:
        print(f"curriculum build failed: {error}", file=sys.stderr)
        raise
