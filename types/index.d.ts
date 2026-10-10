/** One skill that passed the threshold. */
export type SkillRouterHit = { name: string; p: number; loaded: boolean }

/** What the band shows: the last prompt's routing. */
export type SkillRouterLast =
  | { status: 'routed'; hits: SkillRouterHit[]; ms: number }
  | { status: 'failed'; reason: string }

declare module 'claude-code' {
  interface PluginState {
    'skill-router': { last: SkillRouterLast | null }
  }
}
