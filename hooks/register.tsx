import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { SkillRouterLast } from '../types'
import { instructionOf, questionsOf, rank, shouldRoute, stateOf, type Skill } from './route'

const last = atom({ plugin: 'skill-router', key: 'last' } as const, null as SkillRouterLast | null)

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export const register: Register = (on, options) => {
  const threshold = num(options.threshold, 0.8)
  const max = Math.max(0, Math.floor(num(options.max_skills, 3)))
  const timeoutMs = num(options.timeout_ms, 1500)

  on('prompt.submit', async ($, e, next) => {
    if (!shouldRoute(e.text, e.origin.kind)) return next(e)

    let context = e.context
    try {
      // Plugin skills and the person's own; builtins and MCP prompts are not skills.
      const skills: Skill[] = (await $.command.list())
        .filter((c) => (c.source === 'plugin' || c.source === 'user') && c.description.trim() !== '')
        .map((c) => ({ name: c.name, description: c.description }))
      if (skills.length === 0) return next(e)

      const { answers, elapsedMs } = await $.jev.ask({
        state: stateOf(e.text),
        questions: questionsOf(skills),
        timeoutMs,
      })
      const hits = rank(skills, answers, threshold, max)
      await update($, last, (): SkillRouterLast => ({ status: 'routed', hits, ms: elapsedMs }))

      const instruction = instructionOf(hits)
      if (instruction) context = [...(e.context ?? []), instruction]
    } catch (error) {
      // Fail open: a timeout or outage only costs the routing, never the prompt.
      const reason = error instanceof Error ? error.message.replace(/^\$\.jev: /, '') : 'unknown error'
      await update($, last, (): SkillRouterLast => ({ status: 'failed', reason }))
    }
    return next({ ...e, context })
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const state = await read($, last)
    if (e.props.hasSurvey || state === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    if (state.status === 'failed') {
      return (
        <Box>
          <Text dimColor>Jev · no skills loaded: {state.reason}</Text>
        </Box>
      )
    }
    if (state.hits.length === 0) {
      return (
        <Box>
          <Text dimColor>Jev · no skill over {threshold} ({state.ms} ms)</Text>
        </Box>
      )
    }
    return (
      <Box>
        <Text dimColor>Jev · </Text>
        {state.hits.map((hit, i) => (
          <Text key={hit.name} color={hit.loaded ? 'green' : undefined} dimColor={!hit.loaded}>
            {i > 0 ? ' · ' : ''}
            {hit.name} {hit.p.toFixed(2)}
            {hit.loaded ? ' ✓' : ''}
          </Text>
        ))}
        <Text dimColor> ({state.ms} ms)</Text>
      </Box>
    )
  })
}
