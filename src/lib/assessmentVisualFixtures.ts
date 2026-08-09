import type { AssessmentVisual } from '../types/assessmentVisual'

/**
 * A deliberately irregular concave pentagon for polygon competencies.  The
 * inward C vertex makes the concavity obvious while the A–E labels remain
 * readable in student, teacher, answer-key, and print renderers.
 */
export const IRREGULAR_CONCAVE_PENTAGON_VISUAL: AssessmentVisual = {
  id: 'visual-concave-pentagon',
  kind: 'geometry',
  version: 1,
  width: 360,
  height: 240,
  altText: 'An irregular concave pentagon with vertices A, B, C, D, and E.',
  primitives: [
    { type: 'polygon', points: [{ x: 62, y: 48 }, { x: 298, y: 48 }, { x: 218, y: 120 }, { x: 298, y: 192 }, { x: 62, y: 192 }], color: 'blue', fill: 'blue', strokeWidth: 2 },
    { type: 'point', x: 62, y: 48, color: 'ink', radius: 4 },
    { type: 'point', x: 298, y: 48, color: 'ink', radius: 4 },
    { type: 'point', x: 218, y: 120, color: 'red', radius: 4 },
    { type: 'point', x: 298, y: 192, color: 'ink', radius: 4 },
    { type: 'point', x: 62, y: 192, color: 'ink', radius: 4 },
    { type: 'textLabel', x: 48, y: 39, text: 'A', color: 'ink', textSize: 'medium' },
    { type: 'textLabel', x: 306, y: 39, text: 'B', color: 'ink', textSize: 'medium' },
    { type: 'textLabel', x: 226, y: 115, text: 'C', color: 'red', textSize: 'medium' },
    { type: 'textLabel', x: 306, y: 204, text: 'D', color: 'ink', textSize: 'medium' },
    { type: 'textLabel', x: 48, y: 204, text: 'E', color: 'ink', textSize: 'medium' },
  ],
}

/** A small fixture that exercises line marks and curved annotations. */
export const ASSESSMENT_VISUAL_MARKS_FIXTURE: AssessmentVisual = {
  id: 'visual-marks-labels',
  kind: 'geometry',
  version: 1,
  width: 360,
  height: 240,
  altText: 'A segment diagram with equal, parallel, perpendicular, and angle marks.',
  primitives: [
    { type: 'segment', x1: 40, y1: 62, x2: 320, y2: 62, color: 'ink', strokeWidth: 2 },
    { type: 'equalSideMark', x1: 40, y1: 62, x2: 320, y2: 62, count: 2, color: 'blue' },
    { type: 'dashedSegment', x1: 40, y1: 122, x2: 320, y2: 122, color: 'gray', strokeWidth: 2 },
    { type: 'parallelMark', x1: 40, y1: 122, x2: 320, y2: 122, count: 2, color: 'green' },
    { type: 'perpendicularMark', x: 180, y: 182, angle: 0, size: 24, color: 'red' },
    { type: 'angleArc', vertex: { x: 180, y: 182 }, radius: 34, startAngle: 180, endAngle: 270, color: 'purple', strokeWidth: 2 },
    { type: 'arrow', x1: 180, y1: 182, x2: 250, y2: 182, color: 'gold', strokeWidth: 2 },
    { type: 'textLabel', x: 180, y: 226, text: 'Geometry marks', color: 'ink', textSize: 'small', anchor: 'middle' },
  ],
}

/** A named convex case with side-length labels for perimeter/side competencies. */
export const CONVEX_QUADRILATERAL_VISUAL: AssessmentVisual = {
  id: 'visual-convex-quadrilateral',
  kind: 'geometry',
  version: 1,
  width: 360,
  height: 240,
  altText: 'A convex quadrilateral ABCD with side lengths five and four units.',
  primitives: [
    { type: 'polygon', points: [{ x: 70, y: 55 }, { x: 290, y: 55 }, { x: 320, y: 185 }, { x: 50, y: 185 }], color: 'blue', fill: 'blue', strokeWidth: 2 },
    { type: 'textLabel', x: 58, y: 48, text: 'A', color: 'ink', textSize: 'medium' },
    { type: 'textLabel', x: 296, y: 48, text: 'B', color: 'ink', textSize: 'medium' },
    { type: 'textLabel', x: 326, y: 196, text: 'C', color: 'ink', textSize: 'medium' },
    { type: 'textLabel', x: 35, y: 196, text: 'D', color: 'ink', textSize: 'medium' },
    { type: 'textLabel', x: 180, y: 45, text: 'AB = 5', color: 'green', textSize: 'small', anchor: 'middle' },
    { type: 'textLabel', x: 310, y: 124, text: 'BC = 4', color: 'green', textSize: 'small', anchor: 'middle' },
    { type: 'textLabel', x: 185, y: 212, text: 'CD = 5', color: 'green', textSize: 'small', anchor: 'middle' },
    { type: 'textLabel', x: 45, y: 124, text: 'DA = 4', color: 'green', textSize: 'small', anchor: 'middle' },
  ],
}

/** A regular hexagon case for regular-polygon competencies. */
export const REGULAR_HEXAGON_VISUAL: AssessmentVisual = {
  id: 'visual-regular-hexagon',
  kind: 'geometry',
  version: 1,
  width: 360,
  height: 240,
  altText: 'A regular hexagon with six equal sides and vertices A through F.',
  primitives: [
    { type: 'polygon', points: [{ x: 180, y: 44 }, { x: 246, y: 82 }, { x: 246, y: 158 }, { x: 180, y: 196 }, { x: 114, y: 158 }, { x: 114, y: 82 }], color: 'purple', fill: 'purple', strokeWidth: 2 },
    { type: 'equalSideMark', x1: 180, y1: 44, x2: 246, y2: 82, count: 1, color: 'red', strokeWidth: 1 },
    { type: 'equalSideMark', x1: 246, y1: 82, x2: 246, y2: 158, count: 1, color: 'red', strokeWidth: 1 },
    { type: 'textLabel', x: 180, y: 31, text: 'A', color: 'ink', textSize: 'small', anchor: 'middle' },
    { type: 'textLabel', x: 258, y: 80, text: 'B', color: 'ink', textSize: 'small' },
    { type: 'textLabel', x: 258, y: 166, text: 'C', color: 'ink', textSize: 'small' },
    { type: 'textLabel', x: 180, y: 214, text: 'D', color: 'ink', textSize: 'small', anchor: 'middle' },
    { type: 'textLabel', x: 101, y: 166, text: 'E', color: 'ink', textSize: 'small', anchor: 'end' },
    { type: 'textLabel', x: 101, y: 80, text: 'F', color: 'ink', textSize: 'small', anchor: 'end' },
    { type: 'textLabel', x: 180, y: 125, text: '6 equal sides', color: 'purple', textSize: 'small', anchor: 'middle' },
  ],
}

export const ASSESSMENT_VISUAL_FIXTURES = {
  irregularConcavePentagon: IRREGULAR_CONCAVE_PENTAGON_VISUAL,
  marksAndLabels: ASSESSMENT_VISUAL_MARKS_FIXTURE,
  convexQuadrilateral: CONVEX_QUADRILATERAL_VISUAL,
  regularHexagon: REGULAR_HEXAGON_VISUAL,
} as const
