import type { JevNoulQuestion } from '../.claude-plugin/types/jev'
import type { SkillRouterHit } from '../types'

export type Skill = { name: string; description: string }

// Jev sees only this; the head of a long prompt carries the intent.
const MAX_PROMPT_CHARS = 4000

/** Whether a prompt is worth routing: typed by the person, not a command, not a one-word reply. */
export function shouldRoute(text: string, originKind: string): boolean {
  const t = text.trim()
  return (originKind === 'composer' || originKind === 'bridge') && !t.startsWith('/') && t.length >= 12
}

export function stateOf(text: string): { request: string } {
  return { request: text.trim().slice(0, MAX_PROMPT_CHARS) }
}

/**
 * One noul per skill, so two fitting skills both score high; a single choice
 * would split the probability between them. Ids are indices: Jev never sees them.
 */
export function questionsOf(skills: readonly Skill[]): Record<string, JevNoulQuestion> {
  const questions: Record<string, JevNoulQuestion> = {}
  skills.forEach((skill, i) => {
    questions[`s${i}`] = {
      type: 'noul',
      instructions: {
        claim: 'An AI coding agent handling this request should load this skill before starting.',
        skill: { name: skill.name, description: skill.description },
      },
      criteria: {
        true: "The request is squarely the kind of task the skill's description covers.",
        false: 'The skill is unrelated, only loosely related, or covers a different kind of task.',
      },
    }
  })
  return questions
}

/** Skills at or over the threshold, best first; the top `max` are marked to load. */
export function rank(
  skills: readonly Skill[],
  nouls: Readonly<Record<string, { noul: number }>>,
  threshold: number,
  max: number,
): SkillRouterHit[] {
  return skills
    .map((skill, i) => ({ name: skill.name, p: nouls[`s${i}`]?.noul ?? 0 }))
    .filter((hit) => hit.p >= threshold)
    .sort((a, b) => b.p - a.p)
    .map((hit, i) => ({ ...hit, loaded: i < max }))
}

/** The hidden instruction the model reads beside the prompt. */
export function instructionOf(hits: readonly SkillRouterHit[]): string | undefined {
  const load = hits.filter((hit) => hit.loaded)
  if (load.length === 0) return undefined
  const list = load.map((hit) => `${hit.name} (${hit.p.toFixed(2)})`).join(', ')
  return (
    `[skill-router] Jev matched this request to: ${list}. ` +
    'Before doing anything else, load each of these with the Skill tool, in this order, then follow them. ' +
    'Skip one only if, after reading it, it clearly does not apply.'
  )
}
