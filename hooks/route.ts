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

/**
 * The candidates: skills the model can invoke itself (the engine's own listing),
 * minus those already loaded, with descriptions from the command list. A slash
 * command outside that listing (user-only, or one with side effects such as
 * delegating work) is never a candidate.
 */
export function candidatesOf(
  modelSkills: readonly string[],
  commands: readonly { name: string; description: string }[],
  loaded: readonly string[],
): Skill[] {
  const invocable = new Set(modelSkills)
  const done = new Set(loaded)
  return commands
    .filter((c) => invocable.has(c.name) && !done.has(c.name) && c.description.trim() !== '')
    .map((c) => ({ name: c.name, description: c.description }))
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
        claim: 'The user is asking the agent to carry out, right now, a task this skill covers.',
        skill: { name: skill.name, description: skill.description },
      },
      criteria: {
        true: "The request asks the agent to do the kind of task the skill's description covers, in this turn.",
        false:
          'The skill is unrelated or only loosely related, or the user only asks about, discusses, ' +
          'or weighs whether to do such a task without asking for it to be done now.',
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
  const fmt = (hit: SkillRouterHit) => `${hit.name} (${hit.p.toFixed(2)})`
  const load = hits.filter((hit) => hit.loaded)
  const optional = hits.filter((hit) => !hit.loaded)
  if (hits.length === 0) return undefined
  const parts = ['[skill-router] Jev matched this request to skills.']
  if (load.length > 0) {
    parts.push(
      `Load ${load.map(fmt).join(', ')} with the Skill tool before starting, then follow it. ` +
        'Skip it only if, after reading it, it clearly does not apply.',
    )
  }
  if (optional.length > 0) {
    // Each skill costs context; the rest are hints, not orders.
    parts.push(
      `Also possibly relevant: ${optional.map(fmt).join(', ')}. ` +
        'Do not load these unless the task turns out to need one.',
    )
  }
  return parts.join(' ')
}
