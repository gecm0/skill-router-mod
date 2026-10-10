/** One skill suggested for the prompt. */
export type SkillRouterHit = { name: string; p: number }

/** What the band shows: the last prompt's routing. */
export type SkillRouterLast =
  | { status: 'routed'; hits: SkillRouterHit[]; ms: number }
  | { status: 'failed'; reason: string }

declare module 'claude-code' {
  interface PluginState {
    'skill-router': {
      last: SkillRouterLast | null
      /** Skills the Skill tool already loaded this conversation, so they are not loaded twice. */
      loaded: string[]
    }
  }
}
