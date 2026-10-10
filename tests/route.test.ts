import { expect, test } from 'claude-code/testing'

import { candidatesOf, instructionOf, questionsOf, rank, shouldRoute } from '../hooks/route'

const SKILLS = [
  { name: 'animate', description: 'Builds motion.' },
  { name: 'tdd', description: 'Test-driven development.' },
  { name: 'slides', description: 'Builds presentations.' },
  { name: 'emil-design-eng', description: 'UI polish.' },
  { name: 'archify', description: 'Diagrams.' },
]

test('routes only typed prompts that are not commands or one-word replies', () => {
  expect(shouldRoute('make the save button bounce', 'composer')).toBe(true)
  expect(shouldRoute('/commit all of it please', 'composer')).toBe(false)
  expect(shouldRoute('yes', 'composer')).toBe(false)
  expect(shouldRoute('make the save button bounce', 'plugin')).toBe(false)
})

test('one noul per skill, keyed by index, carrying the name and description', () => {
  const q = questionsOf(SKILLS)
  expect(Object.keys(q)).toEqual(['s0', 's1', 's2', 's3', 's4'])
  expect(q.s1?.type).toBe('noul')
  expect(JSON.stringify(q.s1?.instructions)).toContain('Test-driven development.')
})

test('keeps only hits over the threshold, best first, and loads at most max', () => {
  const nouls = { s0: { noul: 0.96 }, s1: { noul: 0.84 }, s2: { noul: 0.1 }, s3: { noul: 0.81 }, s4: { noul: 0.9 } }
  expect(rank(SKILLS, nouls, 0.8, 3)).toEqual([
    { name: 'animate', p: 0.96, loaded: true },
    { name: 'archify', p: 0.9, loaded: true },
    { name: 'tdd', p: 0.84, loaded: true },
    { name: 'emil-design-eng', p: 0.81, loaded: false },
  ])
})

test('a single hit is the one loaded; none means no instruction', () => {
  const one = rank(SKILLS, { s1: { noul: 0.85 } }, 0.8, 1)
  expect(one).toEqual([{ name: 'tdd', p: 0.85, loaded: true }])
  expect(instructionOf(one)).toContain('Load tdd (0.85)')
  expect(instructionOf(rank(SKILLS, { s1: { noul: 0.5 } }, 0.8, 1))).toBeUndefined()
})

test('loads only the best; the rest are offered as optional, not ordered', () => {
  const text = instructionOf([
    { name: 'animate', p: 0.96, loaded: true },
    { name: 'tdd', p: 0.84, loaded: false },
    { name: 'slides', p: 0.81, loaded: false },
  ])
  expect(text).toContain('Load animate (0.96) with the Skill tool')
  expect(text).toContain('Also possibly relevant: tdd (0.84), slides (0.81)')
  expect(text).toContain('Do not load these unless')
})

test('with max 0 every hit is optional and nothing is ordered loaded', () => {
  const text = instructionOf(rank(SKILLS, { s0: { noul: 0.9 } }, 0.8, 0))
  expect(text).not.toContain('Load ')
  expect(text).toContain('Also possibly relevant: animate (0.90)')
})

test('candidates are only model-invocable skills, minus those already loaded', () => {
  const commands = [
    { name: 'tdd', description: 'Test first.' },
    { name: 'codex:rescue', description: 'Delegates work to Codex.' },
    { name: 'animate', description: 'Builds motion.' },
    { name: 'implement', description: 'User-only command.' },
    { name: 'archify', description: '' },
  ]
  const got = candidatesOf(['tdd', 'animate', 'archify'], commands, ['animate'])
  expect(got).toEqual([{ name: 'tdd', description: 'Test first.' }])
})

test('the question excludes prompts that only discuss a task', () => {
  const q = JSON.stringify(questionsOf(SKILLS).s0)
  expect(q).toContain('right now')
  expect(q).toContain('without asking for it to be done now')
})
