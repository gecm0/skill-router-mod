import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { SkillRouterLast } from '../types'
import { candidatesOf, instructionOf, questionsOf, rank, shouldRoute, stateOf, thresholdOf } from './route'

const last = atom({ plugin: 'skill-router', key: 'last' } as const, null as SkillRouterLast | null)
const loaded = atom({ plugin: 'skill-router', key: 'loaded' } as const, [] as string[])

function num(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export const register: Register = (on, options) => {
  const threshold = thresholdOf(options.threshold)
  const max = Math.max(1, Math.floor(num(options.max_suggestions, 3)))
  const timeoutMs = num(options.timeout_ms, 1500)

  on('prompt.submit', async ($, e, next) => {
    if (!shouldRoute(e.text, e.origin.kind)) {
      // Clear the band so it never shows an earlier prompt's suggestions.
      await update($, last, () => null)
      return next(e)
    }

    let context = e.context
    try {
      // The engine's own skill listing is what the model may invoke; the summary
      // breakdown is computed locally and sends nothing.
      const usage = await $.session.usage({ breakdown: 'summary' })
      const listing = usage.context.breakdown?.skills?.skillFrontmatter
      if (!listing) throw new Error('the session lists no skills yet')
      const skills = candidatesOf(
        listing.map((s) => s.name),
        await $.command.list(),
        await read($, loaded),
      )
      if (skills.length === 0) {
        await update($, last, () => null)
        return next(e)
      }

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

  // Record every skill the main conversation loads, suggested or not, so it is
  // not suggested again. A subagent's load never reaches the main context.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const result = await next(e)
    if (e.agentId === undefined && !result.deny && !result.isError) {
      await update($, loaded, (names) => (names.includes(e.skill) ? names : [...names, e.skill]))
    }
    return result
  }).catch(($, e, next) => next(e))

  // A /clear drops the loaded skills from the conversation, so forget them too.
  on('session.end', async ($, e, next) => {
    if (e.reason === 'clear') await update($, loaded, () => [])
    return next(e)
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const state = await read($, last)
    if (e.props.hasSurvey || state === null) return next(e)

    const { Box, Text } = $.ui.resolve(e)
    if (state.status === 'failed') {
      return (
        <Box>
          <Text dimColor>Jev · no suggestions: {state.reason}</Text>
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
        <Text dimColor>Jev suggests · </Text>
        {state.hits.map((hit, i) => (
          <Text key={hit.name} color={i === 0 ? 'green' : undefined} dimColor={i > 0}>
            {i > 0 ? ' · ' : ''}
            {hit.name} {hit.p.toFixed(2)}
          </Text>
        ))}
        <Text dimColor> ({state.ms} ms)</Text>
      </Box>
    )
  })
}
