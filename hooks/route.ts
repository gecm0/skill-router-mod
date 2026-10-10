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
 * minus those already loaded, with descriptions from the command list. User-only
 * commands are left out; skills that act are not, which is why the router only
 * ever suggests.
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

/** Skills at or over the threshold, best first, at most `max` of them. */
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
    .slice(0, max)
}

/**
 * The hidden note the model reads beside the prompt. A suggestion, never an
 * order: a mod cannot tell a skill that only teaches from one that acts
 * (delegates work, runs a subagent), so the model decides.
 */
export function instructionOf(hits: readonly SkillRouterHit[]): string | undefined {
  if (hits.length === 0) return undefined
  const list = hits.map((hit) => `${hit.name} (${hit.p.toFixed(2)})`).join(', ')
  return (
    `[skill-router] Jev suggests these skills may fit this request: ${list}. ` +
    'This is a suggestion, not an instruction. Load one with the Skill tool only if it would ' +
    'clearly help; each skill costs context, so prefer one at most. Never load a skill that ' +
    'runs actions or delegates work unless the user asked for that.'
  )
}

/** A threshold outside 0 to 1 would match everything or nothing; fall back instead. */
export function thresholdOf(value: unknown): number {
  return typeof value === 'number' && value > 0 && value <= 1 ? value : 0.8
}
