export type CurriculumResolutionVersion = {
  id: string
  code: string
  priority: number
  note: string | null
}

export type CurriculumResolutionSubject = {
  id: string
  curriculumVersionId: string
  gradeLevel: string
  name: string
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase('en')
}

export function subjectNamesMatch(subjectName: string, learningArea: string, aliases: string[] = []) {
  const subject = normalized(subjectName)
  return [learningArea, ...aliases].some((candidate) => normalized(candidate) === subject)
}

export function resolveCurriculumVersion(input: {
  versions: CurriculumResolutionVersion[]
  subjects: CurriculumResolutionSubject[]
  gradeLevel: string
  learningArea: string
  aliases?: string[]
  preferredCurriculumCode?: string | null
}) {
  const aliases = input.aliases ?? []
  const eligible = input.versions
    .map((version) => ({
      version,
      subject: input.subjects.find((subject) => subject.curriculumVersionId === version.id
        && subject.gradeLevel === input.gradeLevel
        && subjectNamesMatch(subject.name, input.learningArea, aliases)) ?? null,
    }))
    .filter((item): item is { version: CurriculumResolutionVersion; subject: CurriculumResolutionSubject } => Boolean(item.subject))
    .sort((left, right) => {
      const leftPreferred = input.preferredCurriculumCode && left.version.code === input.preferredCurriculumCode ? 0 : 1
      const rightPreferred = input.preferredCurriculumCode && right.version.code === input.preferredCurriculumCode ? 0 : 1
      return leftPreferred - rightPreferred || left.version.priority - right.version.priority || left.version.id.localeCompare(right.version.id, 'en')
    })

  return eligible[0] ?? null
}
