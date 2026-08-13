#!/usr/bin/env python3
"""Extract source-pinned curriculum standards into reviewable sidecars.

The official PDFs are deliberately not committed. This tool consumes a reviewed
source tree, verifies every file against the source register, and writes only
standards that are explicitly labelled in the official guide. It never derives a
standard from a competency or from model-generated text.
"""

from __future__ import annotations

import argparse
import copy
import hashlib
import json
import re
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Iterable

import pdfplumber

from build_official_manifests import clean_text, normalized


CONTENT_LABEL = re.compile(
    r"^(?:CONTENT\s*STANDARDS?|PAMANTAYANG\s+PANGNILALAMAN)\s*:?\s*",
    flags=re.I,
)
PERFORMANCE_LABEL = re.compile(
    r"^(?:PERFORMANCE\s*STANDARDS?|PAMANTAYAN(?:G|\s+SA)?\s+PAGGANAP)\s*:?\s*",
    flags=re.I,
)
LEARNING_LABEL = re.compile(
    r"(?:LEARNING\s+(?:COMPETENC|STANDARDS?)|KASANAYANG\s+PAMPAGKATUTO|MGA\s+KASANAYANG\s+PAMPAGKATUTO)",
    flags=re.I,
)
SECTION_LABEL = re.compile(
    r"(?:SUGGESTED|ESSENTIAL\s+LIFE\s+SKILLS|LEARNING\s+COMPETENC|"
    r"KASANAYANG\s+PAMPAGKATUTO|MGA\s+KASANAYANG\s+PAMPAGKATUTO|"
    r"NILALAMAN|CONTENT\s*$)",
    flags=re.I,
)
NUMBERED_ITEM = re.compile(r"(?<![\d.])(\d{1,3})\.\s+(?=[^\d.])")
BULLET_ITEM = re.compile(r"(?:^|\s)[•●▪]\s+")
CONTENT_SENTENCE_START = re.compile(
    r"^(?:(?:ANG\s+MGA\s+MAG-AARAL\s+AY|THE\s+LEARNERS)(?:…|\.{3})?\s*)?"
    r"(?:NAIPAMAMALAS|NAIPAPAMALAS|NATUTUTUHAN|NAUUNAWAAN|"
    r"DEMONSTRATE|UNDERSTAND)",
    flags=re.I,
)

FILIPINO_PERIODS = {
    "UNANG": 1,
    "IKALAWANG": 2,
    "IKATLONG": 3,
    "IKAAPAT": 4,
}
ROMAN_PERIODS = {"I": 1, "II": 2, "III": 3, "IV": 4}


@dataclass(frozen=True)
class Cell:
    text: str
    bbox: tuple[float, float, float, float]
    row: int

    @property
    def x0(self) -> float:
        return self.bbox[0]

    @property
    def y0(self) -> float:
        return self.bbox[1]

    @property
    def x1(self) -> float:
        return self.bbox[2]

    @property
    def y1(self) -> float:
        return self.bbox[3]

    @property
    def center_y(self) -> float:
        return (self.y0 + self.y1) / 2


@dataclass
class Standard:
    standard_type: str
    quarter: int
    text: str
    source_page: int
    domain: str | None = None


@dataclass
class ContentCandidate:
    text: str
    domain: str | None
    continued: bool = False
    has_domain_label: bool = False


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def top_level_tables(page: Any) -> list[Any]:
    found = [
        table
        for table in page.find_tables()
        if table.bbox[2] - table.bbox[0] >= page.width * 0.35
    ]
    return [
        table
        for table in found
        if not any(
            other is not table
            and other.bbox[0] <= table.bbox[0]
            and other.bbox[1] <= table.bbox[1]
            and other.bbox[2] >= table.bbox[2]
            and other.bbox[3] >= table.bbox[3]
            and (other.bbox[2] - other.bbox[0]) * (other.bbox[3] - other.bbox[1])
            > (table.bbox[2] - table.bbox[0]) * (table.bbox[3] - table.bbox[1])
            for other in found
        )
    ]


def table_cells(table: Any) -> list[Cell]:
    cells = raw_table_cells(table)
    filtered: list[Cell] = []
    for cell in cells:
        contained = [
            other
            for other in cells
            if other is not cell
            and cell.x0 <= other.x0
            and cell.y0 <= other.y0
            and cell.x1 >= other.x1
            and cell.y1 >= other.y1
            and (cell.x0, cell.y0, cell.x1, cell.y1)
            != (other.x0, other.y0, other.x1, other.y1)
        ]
        joined = clean_text(
            " ".join(item.text for item in sorted(contained, key=lambda item: (item.y0, item.x0)))
        )
        if contained and normalized(cell.text) in normalized(joined):
            continue
        filtered.append(cell)
    return filtered


def raw_table_cells(table: Any) -> list[Cell]:
    values = table.extract()
    cells: list[Cell] = []
    seen: set[tuple[tuple[float, float, float, float], str]] = set()
    for row_index, (row, row_values) in enumerate(zip(table.rows, values)):
        for bbox, value in zip(row.cells, row_values):
            text = clean_text(value)
            if not bbox or not text:
                continue
            normalized_bbox = tuple(round(float(item), 3) for item in bbox)
            key = (normalized_bbox, text)
            if key in seen:
                continue
            seen.add(key)
            cells.append(Cell(text=text, bbox=normalized_bbox, row=row_index))
    return cells


def vertical_overlap(left: Cell, right: Cell) -> float:
    return max(0.0, min(left.y1, right.y1) - max(left.y0, right.y0))


def label_type(text: str) -> str | None:
    if CONTENT_LABEL.fullmatch(clean_text(text)):
        return "content"
    if PERFORMANCE_LABEL.fullmatch(clean_text(text)):
        return "performance"
    return None


def split_label_prefix(text: str) -> tuple[str | None, str]:
    cleaned = clean_text(text)
    for standard_type, pattern in (
        ("content", CONTENT_LABEL),
        ("performance", PERFORMANCE_LABEL),
    ):
        match = pattern.match(cleaned)
        if match:
            return standard_type, clean_text(cleaned[match.end() :])
    return None, cleaned


def nearby_split_label(cells: list[Cell], cell: Cell) -> tuple[str | None, list[Cell]]:
    token = normalized(cell.text)
    if token not in {
        "content",
        "performance",
        "pamantayang",
        "pamantayan",
        "pamantayan sa",
    }:
        return None, []
    candidates = [
        other
        for other in cells
        if other is not cell
        and (
            (abs(other.x0 - cell.x0) <= 4 and abs(other.x1 - cell.x1) <= 4)
            or (
                max(0.0, min(other.x1, cell.x1) - max(other.x0, cell.x0))
                / max(1.0, min(other.x1 - other.x0, cell.x1 - cell.x0))
                >= 0.8
            )
        )
        and -1 <= other.y0 - cell.y0 <= 40
    ]
    for other in sorted(candidates, key=lambda item: item.y0):
        combined = clean_text(f"{cell.text} {other.text}")
        kind = label_type(combined)
        if kind:
            return kind, [cell, other]
    return None, []


def label_groups(cells: list[Cell]) -> list[tuple[str, list[Cell], str]]:
    groups: list[tuple[str, list[Cell], str]] = []
    used: set[Cell] = set()
    for cell in sorted(cells, key=lambda item: (item.y0, item.x0)):
        if cell in used:
            continue
        kind, remainder = split_label_prefix(cell.text)
        if kind and (remainder or label_type(cell.text)):
            groups.append((kind, [cell], remainder))
            used.add(cell)
            continue
        kind, parts = nearby_split_label(cells, cell)
        if kind:
            groups.append((kind, parts, ""))
            used.update(parts)
    return groups


def is_column_header(group: tuple[str, list[Cell], str], cells: list[Cell]) -> bool:
    kind, parts, remainder = group
    if kind != "content":
        return False
    top = min(item.y0 for item in parts)
    bottom = max(item.y1 for item in parts)
    return any(
        LEARNING_LABEL.search(cell.text)
        and max(0.0, min(bottom + 8, cell.y1) - max(top - 8, cell.y0)) > 0
        for cell in cells
    )


def explicit_standards(cells: list[Cell]) -> list[tuple[str, str]]:
    groups = [group for group in label_groups(cells) if not is_column_header(group, cells)]
    output: list[tuple[str, str]] = []
    for index, (kind, parts, remainder) in enumerate(groups):
        left = min(item.x0 for item in parts)
        right = max(item.x1 for item in parts)
        top = min(item.y0 for item in parts)
        bottom = max(item.y1 for item in parts)
        next_top = min(
            (
                min(item.y0 for item in next_parts)
                for _, next_parts, _ in groups[index + 1 :]
                if min(item.y0 for item in next_parts) > top + 1
            ),
            default=float("inf"),
        )
        section_top = min(
            (
                cell.y0
                for cell in cells
                if cell.y0 > top + 1
                and (LEARNING_LABEL.search(cell.text) or SECTION_LABEL.search(cell.text))
            ),
            default=float("inf"),
        )
        end = min(next_top, section_top)

        values: list[Cell] = []
        group_center = (top + bottom) / 2
        competing_centers = [
            (
                (min(item.y0 for item in other_parts) + max(item.y1 for item in other_parts)) / 2,
                other_parts,
            )
            for _, other_parts, _ in groups
            if other_parts != parts
        ]
        for cell in cells:
            if cell in parts or cell.y0 >= end:
                continue
            to_right = cell.x0 >= right - 4
            aligned = vertical_overlap(cell, Cell("", (left, top, right, bottom), -1)) > 0
            continuation = cell.y0 >= top and cell.x0 >= right - 4
            same_column_continuation = (
                bool(remainder)
                and cell.y0 >= bottom - 1
                and abs(cell.x0 - left) <= 8
                and abs(cell.x1 - right) <= 8
            )
            if (to_right and (aligned or continuation)) or same_column_continuation:
                if any(
                    abs(cell.center_y - other_center) < abs(cell.center_y - group_center)
                    for other_center, _ in competing_centers
                ):
                    continue
                if not LEARNING_LABEL.search(cell.text) and not SECTION_LABEL.fullmatch(cell.text):
                    values.append(cell)
        values.sort(key=lambda item: (item.y0, item.x0))
        text = clean_text(" ".join([remainder, *(item.text for item in values)]))
        _, text = split_label_prefix(text)
        if text:
            output.append((kind, text))
    return output


def content_band(cells: list[Cell]) -> tuple[float, float, float] | None:
    for group in label_groups(cells):
        if not is_column_header(group, cells):
            continue
        _, parts, _ = group
        return (
            min(item.x0 for item in parts),
            max(item.x1 for item in parts),
            max(item.y1 for item in parts),
        )
    return None


def split_items(text: str) -> list[str]:
    cleaned = clean_text(text)
    if not cleaned:
        return []
    markers = list(NUMBERED_ITEM.finditer(cleaned))
    if markers:
        prefix = clean_text(cleaned[: markers[0].start()])
        # A numbered list is source structure only when it starts at the cell's
        # beginning (apart from a bullet) or contains at least two items.
        if not prefix or len(markers) >= 2:
            items = []
            for index, marker in enumerate(markers):
                end = markers[index + 1].start() if index + 1 < len(markers) else len(cleaned)
                item = clean_text(cleaned[marker.end() : end])
                if item:
                    items.append(item)
            if prefix and items:
                items[0] = clean_text(f"{prefix} {items[0]}")
            return items
    if BULLET_ITEM.search(cleaned):
        return [clean_text(item) for item in BULLET_ITEM.split(cleaned) if clean_text(item)]
    return [cleaned]


def split_content_cell(text: str) -> list[tuple[str, bool]]:
    cleaned = clean_text(text)
    markers = list(NUMBERED_ITEM.finditer(cleaned))
    if not markers:
        return [(item, False) for item in split_items(cleaned)]
    prefix = clean_text(cleaned[: markers[0].start()])
    if prefix and len(markers) == 1 and not re.search(r"[;:]$", prefix):
        return [(cleaned, False)]
    output: list[tuple[str, bool]] = []
    if prefix:
        output.append((prefix, False))
    for index, marker in enumerate(markers):
        end = markers[index + 1].start() if index + 1 < len(markers) else len(cleaned)
        item = clean_text(cleaned[marker.end() : end])
        if item:
            output.append((item, True))
    return output


def strip_content_header(text: str) -> str:
    return clean_text(
        re.sub(
            r"^(?:THE\s+LEARNERS\s+)?(?:DEMONSTRATE|LEARN)\s+"
            r"(?:AN\s+)?(?:KNOWLEDGE\s+AND\s+)?UNDERSTANDING\s+"
            r"(?:OF|THAT)\s*(?:\.{3}|…)?\s*",
            "",
            clean_text(text),
            flags=re.I,
        )
    )


def candidate_domain(
    cell: Cell,
    cells: list[Cell],
    content_x0: float,
    domain_codes: dict[str, str],
) -> tuple[str | None, bool]:
    candidates: list[Cell] = []
    for other in cells:
        if other is cell or other.x1 > content_x0 + 6:
            continue
        overlap = vertical_overlap(cell, other)
        if overlap <= 0:
            continue
        upper = other.text.upper()
        if (
            upper in {"CONTENT", "CONTENT DOMAIN"}
            or "STANDARD" in upper
            or LEARNING_LABEL.search(other.text)
        ):
            continue
        candidates.append(other)
    for other in sorted(
        candidates,
        key=lambda item: (vertical_overlap(cell, item), item.x1),
        reverse=True,
    ):
        name = clean_text(re.sub(r"^\d{1,3}[.)]?\s*", "", other.text))
        normalized_name = normalized(name)
        code = domain_codes.get(normalized_name)
        if code is None:
            prefix_matches = [
                (domain_name, domain_code)
                for domain_name, domain_code in domain_codes.items()
                if normalized_name.startswith(f"{domain_name} ")
            ]
            if prefix_matches:
                _, code = max(prefix_matches, key=lambda item: len(item[0]))
        if code:
            return code, True
    return None, bool(candidates)


def column_content_standards(
    cells: list[Cell],
    band: tuple[float, float, float] | None,
    domain_codes: dict[str, str],
) -> tuple[list[ContentCandidate], tuple[float, float] | None]:
    if band is None:
        return [], None
    x0, x1, header_bottom = band
    values: list[Cell] = []
    for cell in cells:
        if cell.y0 + 1 < header_bottom:
            continue
        width = max(1.0, cell.x1 - cell.x0)
        overlap = max(0.0, min(cell.x1, x1) - max(cell.x0, x0))
        if overlap / width < 0.75:
            continue
        kind, _ = split_label_prefix(cell.text)
        if kind or LEARNING_LABEL.search(cell.text):
            continue
        upper = cell.text.upper()
        if normalized(cell.text) in {
            "the learners demonstrate knowledge and understanding of",
            "demonstrate knowledge and understanding of",
            "knowledge and understanding of",
            "the learners learn that",
            "learners learn that",
        }:
            continue
        if not re.search(r"\w", cell.text):
            continue
        values.append(cell)
    values.sort(key=lambda item: (item.y0, item.x0))
    items: list[ContentCandidate] = []
    for cell in values:
        extracted = split_content_cell(cell.text)
        if not extracted:
            continue
        domain, has_domain_label = candidate_domain(cell, cells, x0, domain_codes)
        for value, numbered in extracted:
            if items and not numbered and value[:1].islower():
                items[-1].text = clean_text(f"{items[-1].text} {value}")
                if items[-1].domain is None:
                    items[-1].domain = domain
                items[-1].has_domain_label = (
                    items[-1].has_domain_label or has_domain_label
                )
                continue
            items.append(
                ContentCandidate(
                    text=value,
                    domain=domain,
                    continued=(not numbered and value[:1].islower() and domain is None),
                    has_domain_label=has_domain_label,
                )
            )
    header_phrases = {
        "the learners demonstrate knowledge and understanding of",
        "demonstrate knowledge and understanding of",
        "knowledge and understanding of",
        "the learners learn that",
        "learners learn that",
    }
    cleaned_items: list[ContentCandidate] = []
    for item in items:
        original = item.text
        item.text = strip_content_header(item.text)
        if not item.text or normalized(item.text) in header_phrases:
            continue
        if item.text != original and item.text[:1].islower() and item.domain is None:
            item.continued = True
        cleaned_items.append(item)
    return cleaned_items, (x0, x1)


def text_fallback(page_text: str) -> list[tuple[str, str]]:
    text = page_text.replace("\r", "\n")
    results: list[tuple[str, str]] = []
    patterns = (
        (
            "content",
            re.compile(
                r"(?:^|\n)\s*CONTENT\s+STANDARDS?\s*:\s*(.+?)(?=\n\s*PERFORMANCE\s+STANDARDS?\s*:)",
                flags=re.I | re.S,
            ),
        ),
        (
            "performance",
            re.compile(
                r"(?:^|\n)\s*PERFORMANCE\s+STANDARDS?\s*:\s*(.+?)(?=\n\s*(?:LEARNING\s+COMPETENC|CONTENT\s*$)|\Z)",
                flags=re.I | re.S,
            ),
        ),
    )
    for kind, pattern in patterns:
        for match in pattern.finditer(text):
            value = clean_text(match.group(1))
            value = BULLET_ITEM.sub(" ", value).strip()
            if value:
                results.append((kind, value))
    if not any(kind == "performance" for kind, _ in results):
        for match in re.finditer(
            r"(?:^|\n)\s*PERFORMANCE\s+STANDARDS?\s*:?[ \t]*(?:\n[ \t]*)?(.+?)"
            r"(?=\n\s*(?:SUGGESTED\s+PERFORMANCE|LEARNING\s+COMPETENC|CONTENT\s+STANDARDS?)|\Z)",
            text,
            flags=re.I | re.S,
        ):
            value = clean_text(match.group(1))
            if value:
                results.append(("performance", value))
    return results


def leading_spanning_text(page: Any) -> str:
    tables = sorted(top_level_tables(page), key=lambda item: item.bbox[1])
    values: list[str] = []
    if tables:
        table = tables[0]
        for cell in sorted(table_cells(table), key=lambda item: (item.y0, item.x0)):
            if cell.row > 2:
                break
            if (
                split_label_prefix(cell.text)[0]
                or LEARNING_LABEL.search(cell.text)
                or SECTION_LABEL.search(cell.text)
                or re.match(
                    r"^(?:[IVX]+\.?\s+)?(?:SUGGESTED|GLOSSARY|REFERENCES?)\b",
                    cell.text,
                    flags=re.I,
                )
            ):
                break
            width = cell.x1 - cell.x0
            if width < (table.bbox[2] - table.bbox[0]) * 0.75:
                continue
            values.append(cell.text)
    else:
        try:
            lines = page.extract_text_lines() or []
        except Exception:
            lines = []
        for line in sorted(lines, key=lambda item: float(item.get("top", 0))):
            value = clean_text(line.get("text", ""))
            if not value:
                continue
            if re.match(r"^MATATAG\s+CURRICULUM\b", value, flags=re.I):
                continue
            if re.fullmatch(r"(?:PAGE\s+)?\d+", value, flags=re.I):
                continue
            if (
                split_label_prefix(value)[0]
                or LEARNING_LABEL.search(value)
                or SECTION_LABEL.search(value)
                or re.search(r"\b(?:GRADE|BAITANG)\s+\d{1,2}\b", value, flags=re.I)
                or re.search(
                    r"\b(?:UNANG|IKALAWANG|IKATLONG|IKAAPAT)\s+(?:BAITANG|MARKAHAN)\b",
                    value,
                    flags=re.I,
                )
                or re.match(
                    r"^(?:[IVX]+\.?\s+)?(?:QUARTER|MARKAHAN|SUGGESTED|GLOSSARY|REFERENCES?)\b",
                    value,
                    flags=re.I,
                )
            ):
                break
            values.append(value)
    return clean_text(" ".join(values))


def grade_from_page(page_text: str) -> int | None:
    match = re.search(
        r"\b(?:GRADE|BAITANG)\s+(\d{1,2})\s*[–—-]\s*"
        r"(?=(?:QUARTER|UNANG|IKALAWANG|IKATLONG|IKAAPAT)\b)",
        page_text,
        flags=re.I,
    )
    if not match:
        match = re.search(
            r"(?:^|\n)\s*(?:GRADE|BAITANG)\s+(\d{1,2})\s*(?=\n|GRADE\s+LEVEL\s+STANDARD\b)",
            page_text,
            flags=re.I,
        )
    return int(match.group(1)) if match else None


def period_from_text(page_text: str, allowed: set[int]) -> int | None:
    quarter = re.search(r"\bQUARTER\s*([1-4]|I{1,3}|IV)\b", page_text, flags=re.I)
    if quarter:
        token = quarter.group(1).upper()
        value = int(token) if token.isdigit() else ROMAN_PERIODS[token]
        if value in allowed:
            return value
    filipino = re.search(
        r"\b(UNANG|IKALAWANG|IKATLONG|IKAAPAT)\s+MARKAHAN\b",
        page_text,
        flags=re.I,
    )
    if filipino:
        value = FILIPINO_PERIODS[filipino.group(1).upper()]
        if value in allowed:
            return value
    return None


def period_for_page(manifest: dict[str, Any], page: int, page_text: str) -> int:
    periods = sorted(manifest["periods"], key=lambda item: item["sequence"])
    allowed = {int(item["sequence"]) for item in periods}
    explicit = period_from_text(page_text, allowed)
    if explicit is not None:
        return explicit
    if len(periods) == 1:
        return int(periods[0]["sequence"])
    starts = sorted((int(item["sourcePage"]), int(item["sequence"])) for item in periods)
    prior = [sequence for start, sequence in starts if start <= page]
    return prior[-1] if prior else starts[0][1]


def period_at_y(
    manifest: dict[str, Any],
    page: int,
    pdf_page: Any,
    y: float,
) -> int:
    periods = sorted(manifest["periods"], key=lambda item: item["sequence"])
    if len(periods) == 1:
        return int(periods[0]["sequence"])
    allowed = {int(item["sequence"]) for item in periods}
    markers: list[tuple[float, int]] = []
    try:
        lines = pdf_page.extract_text_lines() or []
    except Exception:
        lines = []
    for line in lines:
        value = clean_text(line.get("text", ""))
        period = period_from_text(value, allowed)
        if period is not None:
            markers.append((float(line.get("top", 0)), period))
    starts = sorted((int(item["sourcePage"]), int(item["sequence"])) for item in periods)
    if markers:
        prior = [sequence for start, sequence in starts if start < page]
        current = prior[-1] if prior else starts[0][1]
        for top, period in sorted(markers):
            if top <= y + 8:
                current = period
        return current
    prior = [sequence for start, sequence in starts if start <= page]
    return prior[-1] if prior else starts[0][1]


def deduplicate(standards: Iterable[Standard]) -> list[Standard]:
    output: list[Standard] = []
    seen: set[tuple[str, int, str]] = set()
    for item in standards:
        text = clean_text(item.text).strip(" •")
        if not text:
            continue
        key = (item.standard_type, item.quarter, normalized(text))
        if key in seen:
            continue
        seen.add(key)
        output.append(
            Standard(
                standard_type=item.standard_type,
                quarter=item.quarter,
                text=text,
                source_page=item.source_page,
                domain=item.domain,
            )
        )
    return output


def crop_text(page: Any, bbox: tuple[float, float, float, float]) -> str:
    return clean_text(page.crop(bbox).extract_text() or "")


def strip_standard_prompt(text: str) -> str:
    return clean_text(
        re.sub(
            r"^(?:ANG\s+MGA\s+MAG-AARAL\s+AY|THE\s+LEARNERS)(?:…|\.{3})?\s*",
            "",
            clean_text(text),
            flags=re.I,
        )
    )


def extract_gmrc_manifest(path: Path, manifest: dict[str, Any]) -> list[Standard]:
    competencies_by_page: dict[int, list[dict[str, Any]]] = {}
    for competency in manifest["competencies"]:
        competencies_by_page.setdefault(int(competency["sourcePage"]), []).append(competency)
    standards: list[Standard] = []

    with pdfplumber.open(path) as pdf:
        for page_number in sorted(competencies_by_page):
            page = pdf.pages[page_number - 1]
            all_cells: list[Cell] = []
            performance_groups: list[list[Cell]] = []
            for candidate_table in page.find_tables():
                candidate_cells = table_cells(candidate_table)
                all_cells.extend(raw_table_cells(candidate_table))
                performance_groups.extend(
                    parts
                    for kind, parts, _ in label_groups(candidate_cells)
                    if kind == "performance"
                )
                performance_groups.extend(
                    [cell]
                    for cell in candidate_cells
                    if normalized(cell.text).startswith("pamantayan sa")
                )
            selected: tuple[Any, list[Cell], tuple[float, float, float], list[Cell]] | None = None
            for table in top_level_tables(page):
                cells = table_cells(table)
                band = content_band(cells)
                if band and performance_groups:
                    selected = (table, cells, band, performance_groups[0])
                    break
            if selected is None:
                raise ValueError(f"no GMRC/VE standards matrix found on source page {page_number}")

            table, _cells, band, performance_parts = selected
            x0, x1, header_bottom = band
            performance_top = min(item.y0 for item in performance_parts)
            raw_cells = raw_table_cells(table)
            content_values: list[str] = []
            for cell in raw_cells:
                if cell.y0 < header_bottom - 1 or cell.y1 > performance_top + 1:
                    continue
                if abs(cell.x0 - x0) > 10 or abs(cell.x1 - x1) > 10:
                    continue
                value = strip_standard_prompt(crop_text(page, cell.bbox))
                if value and not CONTENT_LABEL.search(value):
                    content_values.append(value)
            content_values = [
                value
                for value in content_values
                if len(normalized(value)) >= 10
                and not re.search(r"\b(?:MARKAHAN|QUARTER)\b", value, flags=re.I)
            ]
            if not content_values:
                raise ValueError(f"no GMRC/VE content standard found on source page {page_number}")
            content_text = max(content_values, key=len)

            performance_bottom = min(
                (
                    cell.y0
                    for cell in all_cells
                    if cell.y0 > performance_top + 1
                    and re.search(
                        r"LILINANGING\s+PAGPAPAHALAGA|VALUES?\s+TO\s+BE\s+DEVELOPED",
                        cell.text,
                        flags=re.I,
                    )
                ),
                default=table.bbox[3],
            )
            performance_bottom = min(
                performance_bottom,
                min(
                    (
                        cell.y0
                        for cell in raw_cells
                        if cell.y0 > performance_top + 1
                        and cell.x0 <= x0 + 10
                        and cell.x1 >= table.bbox[2] - 10
                    ),
                    default=table.bbox[3],
                ),
            )
            performance_text = crop_text(
                page,
                (x0, performance_top, table.bbox[2], performance_bottom),
            )
            performance_text = strip_standard_prompt(performance_text)
            if len(normalized(performance_text)) < 10:
                raise ValueError(
                    f"no GMRC/VE performance standard found on source page {page_number}"
                )

            page_competencies = competencies_by_page[page_number]
            quarters = {int(item["quarter"]) for item in page_competencies}
            domains = {item["domain"] for item in page_competencies}
            if len(quarters) != 1 or len(domains) != 1:
                raise ValueError(
                    f"ambiguous GMRC/VE competency mapping on source page {page_number}"
                )
            quarter = next(iter(quarters))
            domain = next(iter(domains))
            standards.extend(
                [
                    Standard("content", quarter, content_text, page_number, domain),
                    Standard("performance", quarter, performance_text, page_number, domain),
                ]
            )
    return deduplicate(standards)


def epp_tle_periods(page_text: str) -> tuple[int, ...]:
    match = re.search(
        r"\bQUARTER\s+([1-4]|I{1,3}|IV)(?:\s*/\s*([1-4]|I{1,3}|IV))?\b",
        page_text,
        flags=re.I,
    )
    if not match:
        return ()
    output: list[int] = []
    for token in match.groups():
        if not token:
            continue
        upper = token.upper()
        value = int(upper) if upper.isdigit() else ROMAN_PERIODS[upper]
        if value not in output:
            output.append(value)
    return tuple(output)


def distinct_row_values(row: list[str | None]) -> list[str]:
    values: list[str] = []
    for raw in row:
        value = clean_text(raw)
        if not value or any(normalized(value) == normalized(existing) for existing in values):
            continue
        values.append(value)
    output: list[str] = []
    for value in values:
        key = normalized(value)
        if any(
            key != normalized(other)
            and len(key) >= 8
            and key in normalized(other)
            for other in values
        ):
            continue
        output.append(value)
    return output


def epp_tle_domain(
    values: list[str],
    domain_variants: list[tuple[int, str, str]],
) -> str | None:
    matches: list[tuple[int, str]] = []
    for value in values:
        key = normalized(value)
        if not key or CONTENT_SENTENCE_START.match(value) or re.match(r"^\d{1,3}[.)]", value):
            continue
        for length, variant, code in domain_variants:
            if key == variant or key.startswith(f"{variant} "):
                matches.append((length, code))
    if not matches:
        return None
    best_length = max(length for length, _ in matches)
    codes = {code for length, code in matches if length == best_length}
    return next(iter(codes)) if len(codes) == 1 else None


def performance_row_value(rows: list[list[str | None]], index: int) -> str:
    values = distinct_row_values(rows[index])
    candidates: list[str] = []
    for value in values:
        kind, remainder = split_label_prefix(value)
        if kind == "performance":
            if remainder and normalized(remainder) not in {"standard", "performance standard"}:
                candidates.append(remainder)
            continue
        if (
            CONTENT_LABEL.search(value)
            or LEARNING_LABEL.search(value)
            or normalized(value) in {"the learners", "ang mga mag aaral ay"}
            or re.match(r"^\d{1,3}[.)]\s*", value)
        ):
            continue
        candidates.append(value)
    if not candidates:
        for preceding in reversed(rows[:index]):
            preceding_values = distinct_row_values(preceding)
            if not preceding_values:
                continue
            if any(split_label_prefix(value)[0] for value in preceding_values):
                break
            preceding_candidates = [
                value
                for value in preceding_values
                if not CONTENT_LABEL.search(value)
                and not LEARNING_LABEL.search(value)
                and normalized(value) not in {"the learners", "ang mga mag aaral ay"}
                and not re.match(r"^\d{1,3}[.)]\s*", value)
                and not value.startswith(("•", "●", "▪"))
            ]
            if preceding_candidates:
                candidates.append(max(preceding_candidates, key=len))
            break
    if not candidates:
        return ""
    text = max(candidates, key=len)
    for following in rows[index + 1 :]:
        following_values = distinct_row_values(following)
        if not following_values:
            continue
        if any(split_label_prefix(value)[0] for value in following_values):
            break
        if any(CONTENT_SENTENCE_START.match(value) for value in following_values):
            break
        fragments = [
            value
            for value in following_values
            if not re.match(r"^\d{1,3}[.)]\s*", value)
            and not LEARNING_LABEL.search(value)
            and not CONTENT_LABEL.search(value)
        ]
        if len(fragments) != 1 or not fragments[0][:1].islower():
            break
        text = clean_text(f"{text} {fragments[0]}")
    return clean_text(text)


def content_row_value(rows: list[list[str | None]], index: int) -> str:
    candidates = [
        (strip_standard_prompt(clean_text(value)), column)
        for column, value in enumerate(rows[index])
        if CONTENT_SENTENCE_START.match(clean_text(value))
        and normalized(clean_text(value)) not in {"the learners", "ang mga mag aaral ay"}
    ]
    candidates = [value for value in candidates if len(normalized(value[0])) >= 8]
    if not candidates:
        return ""
    text, column = max(candidates, key=lambda item: len(item[0]))
    for following in rows[index + 1 :]:
        fragment = clean_text(following[column]) if column < len(following) else ""
        if not fragment:
            break
        if (
            split_label_prefix(fragment)[0]
            or CONTENT_SENTENCE_START.match(fragment)
            or re.match(r"^\d{1,3}[.)]\s*", fragment)
            or not fragment[:1].islower()
            or re.search(r"[.!?][\])}\"'’”]*$", text)
        ):
            break
        if normalized(fragment) not in normalized(text):
            text = clean_text(f"{text} {fragment}")
    return re.sub(r"\bo1f\b", "of", text, flags=re.I)


def extract_epp_tle_manifest(path: Path, manifest: dict[str, Any]) -> list[Standard]:
    standards: list[Standard] = []
    pages = [int(item["sourcePage"]) for item in manifest["competencies"]]
    first_page, last_page = min(pages), max(pages)
    allowed_periods = {int(item["sequence"]) for item in manifest["periods"]}
    active_periods: tuple[int, ...] = ()
    domain_variants: list[tuple[int, str, str]] = []
    for domain in manifest["domains"]:
        names = [domain["name"]]
        if ":" in domain["name"]:
            names.append(domain["name"].split(":", 1)[1])
        for name in names:
            variant = normalized(name)
            if variant:
                domain_variants.append((len(variant), variant, domain["code"]))

    with pdfplumber.open(path) as pdf:
        for page_number in range(first_page, last_page + 1):
            page = pdf.pages[page_number - 1]
            page_text = page.extract_text() or ""
            explicit_periods = tuple(
                period for period in epp_tle_periods(page_text) if period in allowed_periods
            )
            if explicit_periods:
                active_periods = explicit_periods
            if not active_periods:
                raise ValueError(f"no EPP/TLE period marker before source page {page_number}")

            for table in top_level_tables(page):
                rows = table.extract()
                table_had_content = False
                for index, row in enumerate(rows):
                    source_values = [clean_text(value) for value in row if clean_text(value)]
                    values = distinct_row_values(row)
                    if not values:
                        continue
                    performance_label = any(
                        split_label_prefix(value)[0] == "performance" for value in values
                    )
                    if performance_label:
                        value = performance_row_value(rows, index)
                        if len(normalized(value)) < 8:
                            raise ValueError(
                                f"empty EPP/TLE performance standard on source page {page_number}"
                            )
                        for quarter in active_periods:
                            standards.append(
                                Standard("performance", quarter, value, page_number, None)
                            )
                        continue

                    value = content_row_value(rows, index)
                    if not value:
                        continue
                    table_had_content = True
                    domain = epp_tle_domain(source_values, domain_variants)
                    for quarter in active_periods:
                        standards.append(
                            Standard("content", quarter, value, page_number, domain)
                        )
                if not table_had_content:
                    band = content_band(table_cells(table))
                    if band:
                        x0, x1, header_bottom = band
                        value = strip_standard_prompt(
                            crop_text(page, (x0, header_bottom, x1, table.bbox[3]))
                        )
                        if CONTENT_SENTENCE_START.match(value) and len(normalized(value)) >= 8:
                            for quarter in active_periods:
                                standards.append(
                                    Standard("content", quarter, value, page_number, None)
                                )
    return deduplicate(standards)


def extract_manifest(path: Path, manifest: dict[str, Any]) -> list[Standard]:
    source_file_name = manifest["source"]["fileName"]
    if "GMRC and VE" in source_file_name:
        return extract_gmrc_manifest(path, manifest)
    if "EPP_TLE" in source_file_name:
        return extract_epp_tle_manifest(path, manifest)

    standards: list[Standard] = []
    last_content: Standard | None = None
    last_performance: Standard | None = None
    allowed_pages = [int(item["sourcePage"]) for item in manifest["periods"]]
    allowed_pages.extend(int(item["sourcePage"]) for item in manifest["competencies"])
    revised_k10 = manifest["curriculumVersion"]["code"] == "REVISED-K10-MATATAG"
    allow_performance_continuation = not revised_k10 or "Science" in source_file_name
    grade_match = re.search(r"\d+", manifest["subject"]["gradeLevel"])
    target_grade = int(grade_match.group()) if grade_match else None
    first_curriculum_page = min(allowed_pages)
    first_page = max(1, first_curriculum_page - 1)
    # A quarter-level performance standard is commonly placed on the page
    # immediately after the final competency row (especially at the end of a
    # guide). Scan a tightly bounded tail without wandering into other grades
    # in the multi-grade K-10 source packs.
    last_page = min(int(manifest["source"]["pageCount"]), max(allowed_pages) + 2)
    carry_band: tuple[float, float] | None = None
    domain_codes = {
        normalized(item["name"]): item["code"] for item in manifest["domains"]
    }

    seen_target_grade = False
    with pdfplumber.open(path) as pdf:
        for page_number, page in enumerate(pdf.pages, 1):
            if page_number < first_page or page_number > last_page:
                continue
            page_text = page.extract_text() or ""
            page_grade = grade_from_page(page_text)
            if revised_k10 and target_grade is not None:
                if page_number < first_curriculum_page and page_grade != target_grade:
                    continue
                if page_grade == target_grade:
                    seen_target_grade = True
                elif page_grade is not None:
                    if seen_target_grade or page_number >= first_curriculum_page:
                        break
                    continue
            if (
                allow_performance_continuation
                and last_performance
                and not re.search(r"[.!?][\])}\"'’”]*$", last_performance.text)
            ):
                continuation = leading_spanning_text(page)
                if continuation:
                    last_performance.text = clean_text(
                        f"{last_performance.text} {continuation}"
                    )
            page_standards: list[tuple[str, str, int, str | None, bool]] = []
            found_content_header = False

            for table in top_level_tables(page):
                cells = table_cells(table)
                table_quarter = period_at_y(manifest, page_number, page, table.bbox[1])
                page_standards.extend(
                    (kind, value, table_quarter, None, False)
                    for kind, value in explicit_standards(cells)
                )
                band = content_band(cells)
                if band:
                    found_content_header = True
                    content, carry_band = column_content_standards(
                        cells, band, domain_codes
                    )
                elif carry_band:
                    x0 = carry_band[0] * page.width
                    x1 = carry_band[1] * page.width
                    content, _ = column_content_standards(
                        cells,
                        (x0, x1, table.bbox[1] - 1),
                        domain_codes,
                    )
                else:
                    content = []
                if (
                    content
                    and last_content
                    and last_content.quarter == table_quarter
                    and last_content.source_page < page_number
                    and last_content.domain is not None
                ):
                    for candidate in content:
                        if candidate.domain is None and not candidate.has_domain_label:
                            candidate.domain = last_content.domain
                if (
                    content
                    and last_content
                    and content[0].continued
                    and last_content.quarter == table_quarter
                    and last_content.source_page < page_number
                    and not re.search(r"[.;!?][\])}\"'’”]*$", last_content.text)
                ):
                    continuation = content.pop(0)
                    last_content.text = clean_text(
                        f"{last_content.text} {continuation.text}"
                    )
                page_standards.extend(
                    (
                        "content",
                        candidate.text,
                        table_quarter,
                        candidate.domain,
                        candidate.continued,
                    )
                    for candidate in content
                )
                if band:
                    carry_band = (band[0] / page.width, band[1] / page.width)

            existing_types = {kind for kind, _, _, _, _ in page_standards}
            if not {"content", "performance"}.issubset(existing_types):
                for kind, value in text_fallback(page_text):
                    if kind not in existing_types:
                        page_standards.append(
                            (
                                kind,
                                value,
                                period_at_y(manifest, page_number, page, page.height / 2),
                                None,
                                False,
                            )
                        )

            for kind, value, quarter, domain, _continued in page_standards:
                values = (
                    split_items(value)
                    if kind == "content" or BULLET_ITEM.search(value)
                    else [value]
                )
                for item in values:
                    standard = Standard(
                        standard_type=kind,
                        quarter=quarter,
                        text=item,
                        source_page=page_number,
                        domain=domain,
                    )
                    standards.append(standard)
                    if kind == "content":
                        last_content = standard
                    if kind == "performance":
                        last_performance = standard

            if not found_content_header and re.search(r"\b(?:QUARTER|MARKAHAN)\b", page_text, flags=re.I):
                carry_band = None

    return deduplicate(standards)


def resolve_source(source_root: Path, file_name: str) -> Path:
    matches = [path for path in source_root.rglob(file_name) if path.is_file()]
    if len(matches) != 1:
        raise ValueError(f"expected exactly one source named {file_name!r}, found {len(matches)}")
    return matches[0]


def sidecar(manifest: dict[str, Any], standards: list[Standard]) -> dict[str, Any]:
    rows: list[dict[str, Any]] = []
    counters: dict[tuple[str, int], int] = {}
    for item in sorted(
        standards,
        key=lambda row: (row.quarter, 0 if row.standard_type == "content" else 1, row.source_page),
    ):
        key = (item.standard_type, item.quarter)
        counters[key] = counters.get(key, 0) + 1
        order = counters[key]
        rows.append(
            {
                "recordId": (
                    f"{manifest['slug']}:standard:{item.standard_type}:"
                    f"period-{item.quarter}:item-{order}"
                ),
                "type": item.standard_type,
                "quarter": item.quarter,
                "domain": item.domain,
                "sortOrder": order,
                "text": item.text,
                "sourcePage": item.source_page,
                "verificationStatus": "verified",
            }
        )
    return {
        "schemaVersion": 1,
        "slug": manifest["slug"],
        "sourceSha256": manifest["source"]["sha256"],
        "sourceFileName": manifest["source"]["fileName"],
        "verificationStatus": "verified",
        "expectedCounts": {
            "content": sum(item.standard_type == "content" for item in standards),
            "performance": sum(item.standard_type == "performance" for item in standards),
        },
        "standards": rows,
    }


def curriculum_payload_hash(manifest: dict[str, Any]) -> str:
    payload = json.dumps(
        {
            "slug": manifest["slug"],
            "sourceSha256": manifest["source"]["sha256"],
            "periods": manifest["periods"],
            "domains": manifest["domains"],
            "standards": manifest["standards"],
            "competencies": manifest["competencies"],
        },
        ensure_ascii=False,
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def apply_sidecar(manifest: dict[str, Any], payload: dict[str, Any]) -> dict[str, Any]:
    """Add verified standards without rebuilding or rewriting competencies."""
    if manifest.get("standards"):
        raise ValueError("manifest already has canonical standards")
    if manifest.get("contentStandards") or manifest.get("performanceStandards"):
        raise ValueError("manifest already has non-empty compatibility standards")
    if payload.get("slug") != manifest["slug"]:
        raise ValueError("standard sidecar slug does not match manifest")
    if payload.get("sourceSha256") != manifest["source"]["sha256"]:
        raise ValueError("standard sidecar source hash does not match manifest")
    if payload.get("sourceFileName") != manifest["source"]["fileName"]:
        raise ValueError("standard sidecar source file does not match manifest")

    standards = copy.deepcopy(payload["standards"])
    periods = {int(item["sequence"]) for item in manifest["periods"]}
    domains = {item["code"] for item in manifest["domains"]}
    page_count = int(manifest["source"]["pageCount"])
    orders: dict[tuple[str, int], list[int]] = {}
    for standard in standards:
        standard_type = standard.get("type")
        quarter = int(standard.get("quarter", 0))
        domain = standard.get("domain")
        source_page = int(standard.get("sourcePage", 0))
        if standard_type not in {"content", "performance"}:
            raise ValueError(f"unsupported standard type {standard_type!r}")
        if quarter not in periods:
            raise ValueError(f"standard uses unknown period {quarter}")
        if domain is not None and domain not in domains:
            raise ValueError(f"standard uses unknown domain {domain!r}")
        if not 1 <= source_page <= page_count:
            raise ValueError(f"standard uses invalid source page {source_page}")
        if standard.get("verificationStatus") != "verified":
            raise ValueError("standard is not verified")
        expected_prefix = (
            f"{manifest['slug']}:standard:{standard_type}:period-{quarter}:item-"
        )
        if not str(standard.get("recordId", "")).startswith(expected_prefix):
            raise ValueError(f"invalid standard record ID {standard.get('recordId')!r}")
        orders.setdefault((standard_type, quarter), []).append(
            int(standard.get("sortOrder", 0))
        )
    for group, actual in orders.items():
        expected = list(range(1, len(actual) + 1))
        if sorted(actual) != expected:
            raise ValueError(f"non-contiguous standard order for {group}")
    for quarter in sorted(periods):
        for standard_type in ("content", "performance"):
            if (standard_type, quarter) not in orders:
                raise ValueError(
                    f"no explicit {standard_type} standard found for period {quarter}"
                )

    updated = copy.deepcopy(manifest)
    content = [item for item in standards if item["type"] == "content"]
    performance = [item for item in standards if item["type"] == "performance"]
    updated["verification"]["method"] = (
        "deterministic table extraction with structural source checks and "
        "source-pinned verified standards extraction"
    )
    updated["verification"]["notes"] = (
        "Competency and standard text is transcribed from the pinned official source file. "
        "Whitespace is normalized; source wording, codes, sequence, period/domain "
        "relationships, and PDF page provenance are retained."
    )
    updated["verification"]["standardsCoverage"] = {
        "status": "verified",
        "contentCount": len(content),
        "performanceCount": len(performance),
        "sourcePinned": True,
    }
    updated["standards"] = standards
    updated["contentStandards"] = content
    updated["performanceStandards"] = performance
    used_pages = [
        *(int(item["sourcePage"]) for item in updated["competencies"]),
        *(int(item["sourcePage"]) for item in standards),
    ]
    updated["source"]["pagesUsed"] = {
        "from": min(used_pages),
        "to": max(used_pages),
    }
    updated["integrity"]["extractorVersion"] = "official-curriculum-v2"
    updated["integrity"]["competencyPayloadSha256"] = curriculum_payload_hash(updated)

    ordered: dict[str, Any] = {}
    inserted_standards = False
    for key, value in updated.items():
        if key in {"standards", "contentStandards", "performanceStandards", "integrity"}:
            continue
        if key == "competencies":
            ordered["standards"] = updated["standards"]
            ordered["contentStandards"] = updated["contentStandards"]
            ordered["performanceStandards"] = updated["performanceStandards"]
            inserted_standards = True
        ordered[key] = value
    if not inserted_standards:
        raise ValueError("manifest has no competencies collection")
    ordered["integrity"] = updated["integrity"]
    return ordered


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source-root", type=Path, required=True)
    parser.add_argument("--manifest-dir", type=Path, default=Path("data/curriculum/official"))
    parser.add_argument(
        "--source-register",
        type=Path,
        default=Path("data/curriculum/sources/official-source-register.json"),
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("data/curriculum/sources/verified-standards"),
    )
    parser.add_argument("--family", action="append", default=[])
    parser.add_argument("--slug", action="append", default=[])
    parser.add_argument("--write", action="store_true")
    parser.add_argument(
        "--write-manifests",
        action="store_true",
        help="apply verified standards to existing manifests after every selected source passes",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    register = json.loads(args.source_register.read_text(encoding="utf-8"))
    sources = {item["fileName"]: item for item in register["sources"]}
    manifests = [json.loads(path.read_text(encoding="utf-8")) for path in sorted(args.manifest_dir.glob("*.json"))]
    selected: list[dict[str, Any]] = []
    for manifest in manifests:
        source = sources[manifest["source"]["fileName"]]
        if args.family and source["family"] not in args.family:
            continue
        if args.slug and manifest["slug"] not in args.slug:
            continue
        if manifest.get("standards"):
            continue
        selected.append(manifest)

    errors: list[str] = []
    outputs: list[tuple[dict[str, Any], dict[str, Any], dict[str, Any] | None]] = []
    for manifest in selected:
        try:
            source_path = resolve_source(args.source_root, manifest["source"]["fileName"])
            expected_size = int(manifest["source"]["byteSize"])
            if source_path.stat().st_size != expected_size:
                raise ValueError(
                    f"source byte-size mismatch: expected {expected_size}, got {source_path.stat().st_size}"
                )
            actual_hash = sha256(source_path)
            if actual_hash != manifest["source"]["sha256"]:
                raise ValueError(
                    f"source SHA-256 mismatch: expected {manifest['source']['sha256']}, got {actual_hash}"
                )
            standards = extract_manifest(source_path, manifest)
            periods = {int(item["sequence"]) for item in manifest["periods"]}
            for period in sorted(periods):
                for kind in ("content", "performance"):
                    if not any(item.quarter == period and item.standard_type == kind for item in standards):
                        raise ValueError(f"no explicit {kind} standard found for period {period}")
            payload = sidecar(manifest, standards)
            updated_manifest = apply_sidecar(manifest, payload) if args.write_manifests else None
            outputs.append((manifest, payload, updated_manifest))
            counts = payload["expectedCounts"]
            print(
                f"extract {manifest['slug']}: "
                f"{counts['content']} content, {counts['performance']} performance"
            )
        except Exception as error:
            errors.append(f"{manifest['slug']}: {error}")

    if errors:
        for error in errors:
            print(f"ERROR {error}", file=sys.stderr)
        print(f"standards extraction failed for {len(errors)} of {len(selected)} manifest(s)", file=sys.stderr)
        return 1

    if args.write:
        args.output_dir.mkdir(parents=True, exist_ok=True)
        for manifest, payload, _ in outputs:
            destination = args.output_dir / f"{manifest['slug']}.json"
            destination.write_text(
                json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
    if args.write_manifests:
        for manifest, _, updated_manifest in outputs:
            if updated_manifest is None:
                raise AssertionError("updated manifest was not prepared")
            destination = args.manifest_dir / f"{manifest['slug']}.json"
            destination.write_text(
                json.dumps(updated_manifest, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
    print(f"standards extraction passed for {len(outputs)} manifest(s)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
