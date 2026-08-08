import type { TosCognitiveAllocation, TosCognitiveCategory } from '../types/tos'

type Decimal = { coefficient: bigint; scale: number }

export type TosAllocationInputRow = {
  id: string
  sortOrder: number
  weight: string
  itemCountOverride: string
  cognitiveWeights: Record<string, string>
}

export type TosAllocationInput = {
  totalItems: number
  categories: TosCognitiveCategory[]
  rows: TosAllocationInputRow[]
}

export type TosAllocatedRow = {
  id: string
  computedWeightPercent: string
  itemCount: number
  itemStart: number | null
  itemEnd: number | null
  itemRangeLabel: string
  cognitiveAllocations: TosCognitiveAllocation[]
}

export type TosAllocationResult = {
  ok: boolean
  errors: string[]
  warnings: string[]
  totalAllocated: number
  rows: TosAllocatedRow[]
  categoryTotals: Record<string, number>
}

const MAX_DECIMAL_SCALE = 8
const MAX_COEFFICIENT_DIGITS = 28
const MAX_TOTAL_ITEMS = 10000

function parseDecimal(value: string, label: string): Decimal {
  const clean = value.trim()
  if (!/^(?:\d+|\d+\.\d+|\.\d+)$/.test(clean)) throw new Error(`${label} must be a non-negative decimal number.`)
  const [whole = '0', fraction = ''] = clean.startsWith('.') ? ['0', clean.slice(1)] : clean.split('.')
  if (fraction.length > MAX_DECIMAL_SCALE) throw new Error(`${label} can use at most ${MAX_DECIMAL_SCALE} decimal places.`)
  const digits = `${whole}${fraction}`.replace(/^0+(?=\d)/, '') || '0'
  if (digits.length > MAX_COEFFICIENT_DIGITS) throw new Error(`${label} is too large.`)
  return { coefficient: BigInt(digits), scale: fraction.length }
}

function alignDecimals(values: Decimal[]) {
  const scale = values.reduce((largest, item) => Math.max(largest, item.scale), 0)
  return values.map((item) => item.coefficient * (10n ** BigInt(scale - item.scale)))
}

function parseOverride(value: string, label: string): number | null {
  const clean = value.trim()
  if (!clean) return null
  if (!/^\d+$/.test(clean)) throw new Error(`${label} must be a whole number or left blank.`)
  const parsed = Number(clean)
  if (!Number.isSafeInteger(parsed) || parsed > MAX_TOTAL_ITEMS) throw new Error(`${label} is outside the supported range.`)
  return parsed
}

function stableOrder<T extends { id: string; sortOrder: number }>(items: T[]) {
  return [...items].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en'))
}

function formatPercentHundredths(hundredths: number) {
  const whole = Math.floor(hundredths / 100)
  const fraction = String(hundredths % 100).padStart(2, '0')
  return `${whole}.${fraction}`
}

function apportion(total: number, ids: string[], weights: bigint[], sortOrders: number[]) {
  const denominator = weights.reduce((sum, value) => sum + value, 0n)
  if (total > 0 && denominator <= 0n) throw new Error('At least one unlocked row must have a positive weight.')
  const counts = new Map(ids.map((id) => [id, 0]))
  if (total === 0) return counts

  const totalBig = BigInt(total)
  const ranked = ids.map((id, index) => {
    const product = totalBig * weights[index]
    const base = product / denominator
    counts.set(id, Number(base))
    return { id, sortOrder: sortOrders[index], remainder: product % denominator }
  })
  const used = [...counts.values()].reduce((sum, value) => sum + value, 0)
  const leftover = total - used
  ranked.sort((a, b) => {
    if (a.remainder !== b.remainder) return a.remainder > b.remainder ? -1 : 1
    return a.sortOrder - b.sortOrder || a.id.localeCompare(b.id, 'en')
  })
  for (let index = 0; index < leftover; index += 1) {
    const winner = ranked[index]
    if (!winner) throw new Error('Allocation reconciliation failed.')
    counts.set(winner.id, (counts.get(winner.id) ?? 0) + 1)
  }
  return counts
}

export function decimalStringsSumTo(values: string[], expected: string) {
  try {
    const parsed = [...values.map((value, index) => parseDecimal(value, `Value ${index + 1}`)), parseDecimal(expected, 'Expected total')]
    const aligned = alignDecimals(parsed)
    const target = aligned.pop() ?? 0n
    return aligned.reduce((sum, value) => sum + value, 0n) === target
  } catch {
    return false
  }
}

export function calculateTosAllocation(input: TosAllocationInput): TosAllocationResult {
  const errors: string[] = []
  const warningSet = new Set<string>()
  const empty = (): TosAllocationResult => ({
    ok: false,
    errors,
    warnings: [...warningSet],
    totalAllocated: 0,
    rows: [],
    categoryTotals: {},
  })

  if (!Number.isSafeInteger(input.totalItems) || input.totalItems < 0 || input.totalItems > MAX_TOTAL_ITEMS) {
    errors.push(`Total test items must be a whole number from 0 to ${MAX_TOTAL_ITEMS}.`)
  }

  const rows = stableOrder(input.rows)
  const categories = stableOrder(input.categories)
  const rowIds = new Set<string>()
  const categoryIds = new Set<string>()
  for (const row of rows) {
    if (!row.id.trim()) errors.push('Every competency row needs a stable ID.')
    else if (rowIds.has(row.id)) errors.push(`Duplicate competency row ID: ${row.id}.`)
    rowIds.add(row.id)
  }
  for (const category of categories) {
    if (!category.id.trim()) errors.push('Every cognitive category needs a stable ID.')
    else if (categoryIds.has(category.id)) errors.push(`Duplicate cognitive category ID: ${category.id}.`)
    categoryIds.add(category.id)
  }
  if (input.totalItems > 0 && rows.length === 0) errors.push('Select at least one verified competency before allocating test items.')
  if (input.totalItems > 0 && categories.length === 0) errors.push('Add at least one cognitive category before allocating test items.')
  if (errors.length) return empty()

  let scaledWeights: bigint[] = []
  try {
    scaledWeights = alignDecimals(rows.map((row, index) => parseDecimal(row.weight, `Weight for competency ${index + 1}`)))
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'A competency weight is invalid.')
    return empty()
  }
  const totalWeight = scaledWeights.reduce((sum, value) => sum + value, 0n)
  if (input.totalItems > 0 && totalWeight === 0n) {
    errors.push('At least one competency must have a positive weight.')
    return empty()
  }
  const weightPercentHundredths = totalWeight > 0n
    ? apportion(10000, rows.map((row) => row.id), scaledWeights, rows.map((row) => row.sortOrder))
    : new Map(rows.map((row) => [row.id, 0]))

  const overrides = new Map<string, number | null>()
  try {
    rows.forEach((row, index) => overrides.set(row.id, parseOverride(row.itemCountOverride, `Item override for competency ${index + 1}`)))
  } catch (error) {
    errors.push(error instanceof Error ? error.message : 'An item-count override is invalid.')
    return empty()
  }

  const fixedRows = rows.filter((row) => overrides.get(row.id) !== null)
  const unlockedRows = rows.filter((row) => overrides.get(row.id) === null)
  const fixedSum = fixedRows.reduce((sum, row) => sum + (overrides.get(row.id) ?? 0), 0)
  if (fixedSum > input.totalItems) {
    errors.push(`Manual item overrides total ${fixedSum}, which exceeds the selected ${input.totalItems} items.`)
    return empty()
  }

  const rowCounts = new Map<string, number>()
  fixedRows.forEach((row) => {
    const count = overrides.get(row.id) ?? 0
    rowCounts.set(row.id, count)
    if (count > 0 && scaledWeights[rows.indexOf(row)] === 0n) warningSet.add('A manual item override assigns items to a zero-weight competency.')
  })
  const remaining = input.totalItems - fixedSum
  if (remaining > 0 && unlockedRows.length === 0) {
    errors.push(`${remaining} item(s) remain, but every competency item count is manually locked.`)
    return empty()
  }
  if (remaining >= 0 && unlockedRows.length > 0) {
    const ids = unlockedRows.map((row) => row.id)
    const weights = unlockedRows.map((row) => scaledWeights[rows.indexOf(row)])
    const order = unlockedRows.map((row) => row.sortOrder)
    try {
      const apportioned = apportion(remaining, ids, weights, order)
      apportioned.forEach((count, id) => rowCounts.set(id, count))
    } catch (error) {
      errors.push(error instanceof Error ? error.message : 'The remaining items could not be allocated.')
      return empty()
    }
  }

  const parsedCategoryWeights = new Map<string, bigint[]>()
  for (const row of rows) {
    try {
      const decimals = categories.map((category) => parseDecimal(
        row.cognitiveWeights[category.id] ?? category.weight,
        `${category.label} weight for competency ${row.sortOrder}`,
      ))
      const aligned = alignDecimals(decimals)
      if ((rowCounts.get(row.id) ?? 0) > 0 && aligned.every((value) => value === 0n)) {
        errors.push(`Competency ${row.sortOrder} needs at least one positive cognitive-category weight.`)
      }
      parsedCategoryWeights.set(row.id, aligned)
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Cognitive weights for competency ${row.sortOrder} are invalid.`)
    }
  }
  if (errors.length) return empty()

  const categoryTotals: Record<string, number> = Object.fromEntries(categories.map((category) => [category.id, 0]))
  const rowsWithCategories = rows.map((row) => {
    const itemCount = rowCounts.get(row.id) ?? 0
    const weights = parsedCategoryWeights.get(row.id) ?? categories.map(() => 0n)
    const categoryCounts = itemCount === 0
      ? new Map(categories.map((category) => [category.id, 0]))
      : apportion(itemCount, categories.map((category) => category.id), weights, categories.map((category) => category.sortOrder))
    categoryCounts.forEach((count, categoryId) => { categoryTotals[categoryId] = (categoryTotals[categoryId] ?? 0) + count })
    if (scaledWeights[rows.indexOf(row)] > 0n && itemCount === 0) warningSet.add(`Competency ${row.sortOrder} has a positive weight but rounds to zero items.`)
    return { row, itemCount, categoryCounts }
  })

  let cursor = 1
  const allocatedRows: TosAllocatedRow[] = rowsWithCategories.map(({ row, itemCount, categoryCounts }) => {
    const itemStart = itemCount > 0 ? cursor : null
    const cognitiveAllocations = categories.map((category) => {
      const count = categoryCounts.get(category.id) ?? 0
      const start = count > 0 ? cursor : null
      const end = count > 0 ? cursor + count - 1 : null
      if (end !== null) cursor = end + 1
      return {
        categoryId: category.id,
        label: category.label,
        shortLabel: category.shortLabel,
        itemCount: count,
        itemStart: start,
        itemEnd: end,
        rangeLabel: start === null || end === null ? '' : start === end ? String(start) : `${start}–${end}`,
      }
    })
    const itemEnd = itemCount > 0 ? cursor - 1 : null
    return {
      id: row.id,
      computedWeightPercent: formatPercentHundredths(weightPercentHundredths.get(row.id) ?? 0),
      itemCount,
      itemStart,
      itemEnd,
      itemRangeLabel: itemStart === null || itemEnd === null ? '' : itemStart === itemEnd ? String(itemStart) : `${itemStart}–${itemEnd}`,
      cognitiveAllocations,
    }
  })

  const totalAllocated = allocatedRows.reduce((sum, row) => sum + row.itemCount, 0)
  if (totalAllocated !== input.totalItems || cursor !== input.totalItems + 1) {
    errors.push('Item allocation did not reconcile exactly to the selected total.')
  }
  for (const row of allocatedRows) {
    const cognitiveTotal = row.cognitiveAllocations.reduce((sum, item) => sum + item.itemCount, 0)
    if (cognitiveTotal !== row.itemCount) errors.push(`Cognitive allocations for row ${row.id} do not match its item count.`)
  }

  return {
    ok: errors.length === 0,
    errors,
    warnings: [...warningSet],
    totalAllocated,
    rows: allocatedRows,
    categoryTotals,
  }
}
