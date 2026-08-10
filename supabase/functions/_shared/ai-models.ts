/**
 * The model/configuration boundary for raw Gemini v1beta generateContent.
 *
 * Keep this module free of provider SDK imports: Edge Functions and Vitest
 * both consume it.  Gemini's response schema uses the provider's uppercase
 * SchemaType values, not JSON-Schema's lowercase spelling.
 */

export type AiModelId =
  | 'gemini-3.5-flash-lite'
  | 'gemini-3.1-flash-lite'
  | 'gemini-3.6-flash'
  | 'gemini-3.5-flash'

export type LiteAiModelId = 'gemini-3.5-flash-lite' | 'gemini-3.1-flash-lite'

export type AssessmentQuestionType =
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'constructed_response'
  | 'identification'
  | 'fill_in_the_blank'
  | 'numerical_answer'
  | 'problem_solving'
  | 'matching'
  | 'multiple_select'
  | 'essay'

export const ASSESSMENT_QUESTION_TYPES: readonly AssessmentQuestionType[] = [
  'multiple_choice',
  'true_false',
  'short_answer',
  'constructed_response',
  'identification',
  'fill_in_the_blank',
  'numerical_answer',
  'problem_solving',
  'matching',
  'multiple_select',
  'essay',
] as const

export const DEFAULT_MODEL: AiModelId = 'gemini-3.5-flash-lite'
export const DEFAULT_FALLBACK_MODEL: LiteAiModelId = 'gemini-3.1-flash-lite'

export const ALLOWED_MODELS = new Set<AiModelId>([
  'gemini-3.5-flash-lite',
  'gemini-3.1-flash-lite',
  'gemini-3.6-flash',
  'gemini-3.5-flash',
])

export function isAiModelId(value: unknown): value is AiModelId {
  return typeof value === 'string' && ALLOWED_MODELS.has(value as AiModelId)
}

export function isLiteModel(value: unknown): value is LiteAiModelId {
  return value === 'gemini-3.5-flash-lite' || value === 'gemini-3.1-flash-lite'
}

export function isAssessmentQuestionType(value: unknown): value is AssessmentQuestionType {
  return typeof value === 'string' && (ASSESSMENT_QUESTION_TYPES as readonly string[]).includes(value)
}

export type GeminiSchemaType = 'STRING' | 'NUMBER' | 'INTEGER' | 'BOOLEAN' | 'OBJECT' | 'ARRAY'

/** The bounded subset accepted by Gemini's raw responseSchema field. */
export type GeminiSchema = {
  type?: GeminiSchemaType
  format?: string
  description?: string
  nullable?: boolean
  enum?: Array<string | number | boolean>
  minItems?: number
  maxItems?: number
  minProperties?: number
  maxProperties?: number
  properties?: Record<string, GeminiSchema>
  required?: string[]
  propertyOrdering?: string[]
  items?: GeminiSchema
}

const objectSchema = (
  properties: Record<string, GeminiSchema>,
  required: string[],
  propertyOrdering = required,
): GeminiSchema => ({
  type: 'OBJECT',
  properties,
  required,
  propertyOrdering,
})

const stringArray = (minItems = 0, maxItems = 30): GeminiSchema => ({
  type: 'ARRAY',
  minItems,
  maxItems,
  items: { type: 'STRING' },
})

const criterionSchema = objectSchema(
  {
    id: { type: 'STRING' },
    label: { type: 'STRING' },
    pointsPossible: { type: 'NUMBER' },
    description: { type: 'STRING' },
  },
  ['id', 'label', 'pointsPossible'],
)

const criterionArray = (maxItems = 12, minItems = 0): GeminiSchema => ({
  type: 'ARRAY',
  minItems,
  maxItems,
  items: criterionSchema,
})

const choiceSchema = objectSchema(
  { id: { type: 'STRING' }, text: { type: 'STRING' } },
  ['id', 'text'],
)

const choicesSchema = (minItems = 2, maxItems = 6): GeminiSchema => ({
  type: 'ARRAY',
  minItems,
  maxItems,
  items: choiceSchema,
})

const visualPointSchema: GeminiSchema = objectSchema(
  { x: { type: 'NUMBER' }, y: { type: 'NUMBER' } },
  ['x', 'y'],
)

/**
 * Visuals deliberately use one bounded object schema rather than oneOf. The
 * Gemini responseSchema subset does not reliably support union keywords;
 * strict per-element discrimination is performed by the Edge validator.
 */
const visualElementSchema: GeminiSchema = objectSchema(
  {
    type: { type: 'STRING', enum: ['point', 'segment', 'dashedSegment', 'polygon', 'circle', 'arc', 'angleArc', 'textLabel', 'tickMark', 'equalSideMark', 'parallelMark', 'perpendicularMark', 'arrow'] },
    x: { type: 'NUMBER' },
    y: { type: 'NUMBER' },
    x1: { type: 'NUMBER' },
    y1: { type: 'NUMBER' },
    x2: { type: 'NUMBER' },
    y2: { type: 'NUMBER' },
    cx: { type: 'NUMBER' },
    cy: { type: 'NUMBER' },
    radius: { type: 'NUMBER' },
    startAngle: { type: 'NUMBER' },
    endAngle: { type: 'NUMBER' },
    angle: { type: 'NUMBER' },
    size: { type: 'NUMBER' },
    vertex: visualPointSchema,
    points: { type: 'ARRAY', minItems: 3, maxItems: 12, items: visualPointSchema },
    text: { type: 'STRING' },
    count: { type: 'INTEGER', enum: [1, 2, 3] },
    color: { type: 'STRING', enum: ['ink', 'blue', 'red', 'green', 'gold', 'purple', 'gray'] },
    fill: { type: 'STRING', enum: ['ink', 'blue', 'red', 'green', 'gold', 'purple', 'gray'] },
    strokeWidth: { type: 'INTEGER', enum: [1, 2, 3] },
    textSize: { type: 'STRING', enum: ['small', 'medium', 'large'] },
    anchor: { type: 'STRING', enum: ['start', 'middle', 'end'] },
  },
  ['type'],
)

const visualSchema: GeminiSchema = {
  type: 'OBJECT',
  nullable: true,
  properties: {
    id: { type: 'STRING' },
    kind: { type: 'STRING', enum: ['geometry'] },
    version: { type: 'INTEGER', enum: [1] },
    width: { type: 'NUMBER' },
    height: { type: 'NUMBER' },
    altText: { type: 'STRING' },
    primitives: { type: 'ARRAY', minItems: 1, maxItems: 80, items: visualElementSchema },
  },
  required: ['id', 'kind', 'version', 'width', 'height', 'altText', 'primitives'],
  propertyOrdering: ['id', 'kind', 'version', 'width', 'height', 'altText', 'primitives'],
}

const answerSchemas: Record<AssessmentQuestionType, GeminiSchema> = {
  multiple_choice: objectSchema(
    { type: { type: 'STRING', enum: ['multiple_choice'] }, choices: choicesSchema(3, 5), choiceId: { type: 'STRING' } },
    ['type', 'choices', 'choiceId'],
  ),
  true_false: objectSchema(
    { type: { type: 'STRING', enum: ['true_false'] }, value: { type: 'BOOLEAN' } },
    ['type', 'value'],
  ),
  short_answer: objectSchema(
    { type: { type: 'STRING', enum: ['short_answer'] }, acceptedAnswers: stringArray(1, 20), caseSensitive: { type: 'BOOLEAN' } },
    ['type', 'acceptedAnswers', 'caseSensitive'],
  ),
  constructed_response: objectSchema(
    {
      type: { type: 'STRING', enum: ['constructed_response'] },
      expectedResponse: { type: 'STRING' },
      sampleResponse: { type: 'STRING' },
      rubricGuidance: { type: 'STRING' },
      expectedElements: stringArray(0, 30),
      rubric: criterionArray(),
    },
    ['type', 'expectedResponse', 'sampleResponse'],
  ),
  identification: objectSchema(
    { type: { type: 'STRING', enum: ['identification'] }, acceptedAnswers: stringArray(1, 20), caseSensitive: { type: 'BOOLEAN' } },
    ['type', 'acceptedAnswers', 'caseSensitive'],
  ),
  fill_in_the_blank: objectSchema(
    {
      type: { type: 'STRING', enum: ['fill_in_the_blank'] },
      blanks: {
        type: 'ARRAY',
        minItems: 1,
        maxItems: 12,
        items: objectSchema(
          { id: { type: 'STRING' }, acceptedAnswers: stringArray(1, 20), caseSensitive: { type: 'BOOLEAN' }, pointsPossible: { type: 'NUMBER' } },
          ['id', 'acceptedAnswers'],
        ),
      },
    },
    ['type', 'blanks'],
  ),
  numerical_answer: objectSchema(
    {
      type: { type: 'STRING', enum: ['numerical_answer'] },
      value: { type: 'NUMBER' },
      tolerance: { type: 'NUMBER' },
      unit: { type: 'STRING' },
      requireUnit: { type: 'BOOLEAN' },
    },
    ['type', 'value'],
  ),
  problem_solving: objectSchema(
    {
      type: { type: 'STRING', enum: ['problem_solving'] },
      finalAnswer: { type: 'STRING' },
      solutionOutline: { type: 'STRING' },
      subparts: {
        type: 'ARRAY',
        minItems: 0,
        maxItems: 12,
        items: objectSchema(
          {
            id: { type: 'STRING' },
            prompt: { type: 'STRING' },
            expectedAnswer: { type: 'STRING' },
            pointsPossible: { type: 'NUMBER' },
            scoringCriteria: criterionArray(),
          },
          ['id', 'prompt', 'pointsPossible'],
        ),
      },
      scoringCriteria: criterionArray(),
    },
    ['type', 'finalAnswer', 'solutionOutline'],
  ),
  matching: objectSchema(
    {
      type: { type: 'STRING', enum: ['matching'] },
      prompts: { type: 'ARRAY', minItems: 2, maxItems: 30, items: objectSchema({ id: { type: 'STRING' }, text: { type: 'STRING' } }, ['id', 'text']) },
      choices: { type: 'ARRAY', minItems: 2, maxItems: 30, items: objectSchema({ id: { type: 'STRING' }, text: { type: 'STRING' }, label: { type: 'STRING' } }, ['id', 'text']) },
      mappings: { type: 'ARRAY', minItems: 2, maxItems: 30, items: objectSchema({ promptId: { type: 'STRING' }, choiceId: { type: 'STRING' }, pointsPossible: { type: 'NUMBER' } }, ['promptId', 'choiceId']) },
      reusableChoices: { type: 'BOOLEAN' },
      pointsPerMatch: { type: 'NUMBER' },
      groupPointsPossible: { type: 'NUMBER' },
    },
    ['type', 'prompts', 'choices', 'mappings'],
  ),
  multiple_select: objectSchema(
    {
      type: { type: 'STRING', enum: ['multiple_select'] },
      choices: choicesSchema(3, 6),
      choiceIds: stringArray(1, 6),
      scoringPolicy: { type: 'STRING', enum: ['all_or_nothing'] },
    },
    ['type', 'choices', 'choiceIds', 'scoringPolicy'],
  ),
  essay: objectSchema(
    {
      type: { type: 'STRING', enum: ['essay'] },
      keyPoints: stringArray(1, 30),
      rubric: criterionArray(),
      expectedResponse: { type: 'STRING' },
      scoringNotes: { type: 'STRING' },
    },
    ['type', 'keyPoints'],
  ),
}

/**
 * Return the provider-side schema for one assessment candidate.
 *
 * Keep this envelope deliberately shallow. Gemini structured output is used to
 * guarantee a JSON object and the fixed question-type discriminator, while the
 * authoritative per-question answer and visual contracts are enforced by the
 * Edge validator after parsing. Deeply nesting all answer variants plus the
 * full visual primitive schema in every request previously caused unreliable
 * provider generation, especially after visual support was added.
 */
/**
 * Legacy generateContent responseSchema used by the older Lite fallback.
 * Keep it shallow, but never use an empty OBJECT schema: Gemini's Schema
 * validator requires OBJECT properties to be non-empty.
 */
export function responseSchemaForQuestionType(type: AssessmentQuestionType): GeminiSchema {
  return objectSchema(
    {
      questionType: { type: 'STRING', enum: [type] },
      prompt: { type: 'STRING' },
      answer: objectSchema(
        { type: { type: 'STRING', enum: [type] } },
        ['type'],
      ),
      rationale: { type: 'STRING' },
      referencedResources: stringArray(0, 10),
      visual: {
        type: 'OBJECT',
        nullable: true,
        properties: {
          kind: { type: 'STRING', enum: ['geometry'] },
          version: { type: 'INTEGER', enum: [1] },
        },
        required: ['kind', 'version'],
        propertyOrdering: ['kind', 'version'],
      },
    },
    ['questionType', 'prompt', 'answer', 'rationale', 'referencedResources', 'visual'],
    ['questionType', 'prompt', 'answer', 'rationale', 'referencedResources', 'visual'],
  )
}

/** Current JSON-Schema dialect used inside generationConfig.responseFormat. */
export type GeminiJsonSchema = {
  type?: string | string[]
  enum?: Array<string | number | boolean>
  properties?: Record<string, GeminiJsonSchema>
  required?: string[]
  items?: GeminiJsonSchema
  anyOf?: GeminiJsonSchema[]
  additionalProperties?: boolean | GeminiJsonSchema
  minItems?: number
  maxItems?: number
}

/**
 * Current Gemini 3.5 Flash-Lite structured-output contract. The provider only
 * owns the top-level envelope and discriminators; validateAssessmentCandidate
 * remains authoritative for the full answer and safe-visual structures.
 */
export function responseJsonSchemaForQuestionType(type: AssessmentQuestionType): GeminiJsonSchema {
  return {
    type: 'object',
    properties: {
      questionType: { type: 'string', enum: [type] },
      prompt: { type: 'string' },
      answer: {
        type: 'object',
        properties: { type: { type: 'string', enum: [type] } },
        required: ['type'],
        additionalProperties: true,
      },
      rationale: { type: 'string' },
      referencedResources: { type: 'array', minItems: 0, maxItems: 10, items: { type: 'string' } },
      visual: {
        anyOf: [
          { type: 'null' },
          {
            type: 'object',
            properties: {
              kind: { type: 'string', enum: ['geometry'] },
              version: { type: 'integer', enum: [1] },
            },
            required: ['kind', 'version'],
            additionalProperties: true,
          },
        ],
      },
    },
    required: ['questionType', 'prompt', 'answer', 'rationale', 'referencedResources', 'visual'],
    additionalProperties: false,
  }
}

/** Schema used by the explicit verifier operation, not by normal generation. */
export const verifierResponseSchema: GeminiSchema = objectSchema(
  {
    status: { type: 'STRING', enum: ['pass', 'needs_repair'] },
    answerValid: { type: 'BOOLEAN' },
    competencyAligned: { type: 'BOOLEAN' },
    cognitiveAlignment: { type: 'STRING', enum: ['good', 'questionable'] },
    ambiguityDetected: { type: 'BOOLEAN' },
    factualOrMathIssue: { type: 'BOOLEAN' },
    issues: stringArray(0, 12),
    repairGuidance: stringArray(0, 12),
  },
  ['status', 'answerValid', 'competencyAligned', 'cognitiveAlignment', 'ambiguityDetected', 'factualOrMathIssue', 'issues', 'repairGuidance'],
)

/**
 * Output budgets are deliberately bounded by semantic complexity.  These
 * values leave enough room for a structured response while preventing a
 * malformed/verbose candidate from consuming an unbounded request.
 */
export const QUESTION_TYPE_MAX_OUTPUT_TOKENS: Readonly<Record<AssessmentQuestionType, number>> = {
  multiple_choice: 4096,
  true_false: 4096,
  short_answer: 6144,
  identification: 4096,
  fill_in_the_blank: 6144,
  numerical_answer: 6144,
  multiple_select: 6144,
  constructed_response: 8192,
  matching: 8192,
  problem_solving: 8192,
  essay: 12288,
}

export function maxOutputTokensForQuestionType(value: unknown): number {
  return isAssessmentQuestionType(value) ? QUESTION_TYPE_MAX_OUTPUT_TOKENS[value] : 4096
}

/**
 * Build the safe generationConfig fragment. Deprecated/unsupported sampling
 * controls are intentionally destructured away, including snake_case forms
 * that can otherwise sneak in through persisted settings or test fixtures.
 */
export function generationConfigFor(model: AiModelId, overrides: Record<string, unknown> = {}) {
  const {
    temperature: _temperature,
    topP: _topP,
    topK: _topK,
    top_p: _topPSnake,
    top_k: _topKSnake,
    candidateCount: _candidateCount,
    candidate_count: _candidateCountSnake,
    presencePenalty: _presencePenalty,
    presence_penalty: _presencePenaltySnake,
    frequencyPenalty: _frequencyPenalty,
    frequency_penalty: _frequencyPenaltySnake,
    seed: _seed,
    stopSequences: _stopSequences,
    stop_sequences: _stopSequencesSnake,
    responseFormat: _responseFormat,
    response_format: _responseFormatSnake,
    questionType: requestedQuestionType,
    responseSchema: requestedResponseSchema,
    responseMimeType: requestedResponseMimeType,
    thinkingConfig: requestedThinking,
    ...safeOverrides
  } = overrides

  const questionType = isAssessmentQuestionType(requestedQuestionType) ? requestedQuestionType : undefined
  const requestedMaxOutputTokens = safeOverrides.maxOutputTokens
  const maxOutputTokens = typeof requestedMaxOutputTokens === 'number' && Number.isFinite(requestedMaxOutputTokens)
    ? Math.min(12288, Math.max(1, Math.floor(requestedMaxOutputTokens)))
    : undefined
  const base: Record<string, unknown> = {
    maxOutputTokens: questionType ? maxOutputTokensForQuestionType(questionType) : (maxOutputTokens ?? 4096),
  }

  if (questionType) {
    // IMPORTANT: normal assessment generation/repair uses raw v1beta
    // generateContent. The production-proven contract is JSON MIME mode only.
    // Do not attach responseFormat or responseSchema here: both have caused
    // provider-side INVALID_ARGUMENT/HTTP 400 failures as the assessment
    // answer + visual contract evolved. The prompt defines the exact shape and
    // validateAssessmentCandidate remains authoritative after JSON parsing.
    base.responseMimeType = 'application/json'
  } else if (typeof requestedResponseMimeType === 'string' && requestedResponseMimeType.trim()) {
    base.responseMimeType = requestedResponseMimeType
    if (requestedResponseSchema && typeof requestedResponseSchema === 'object') base.responseSchema = requestedResponseSchema
  }

  if (isLiteModel(model)) {
    // Gemini 3 Lite models use the product's high-thinking contract.
    base.thinkingConfig = { thinkingLevel: 'HIGH' }
  } else if (requestedThinking && typeof requestedThinking === 'object') {
    base.thinkingConfig = requestedThinking
  }

  return base
}

export function fallbackAllowed(preferred: AiModelId, fallback: AiModelId, enabled: boolean) {
  return enabled && isLiteModel(preferred) && isLiteModel(fallback) && preferred !== fallback
}
