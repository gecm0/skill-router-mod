import { expect, test } from 'claude-code/testing'

import { candidatesOf, instructionOf, questionsOf, rank, shouldRoute, thresholdOf } from '../hooks/route'

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

test('the question excludes prompts that only discuss a task', () => {
  const q = JSON.stringify(questionsOf(SKILLS).s0)
  expect(q).toContain('right now')
  expect(q).toContain('without asking for it to be done now')
})

test('keeps hits over the threshold, best first, at most max', () => {
  const nouls = { s0: { noul: 0.96 }, s1: { noul: 0.84 }, s2: { noul: 0.1 }, s3: { noul: 0.81 }, s4: { noul: 0.9 } }
  expect(rank(SKILLS, nouls, 0.8, 3)).toEqual([
    { name: 'animate', p: 0.96 },
    { name: 'archify', p: 0.9 },
    { name: 'tdd', p: 0.84 },
  ])
  expect(rank(SKILLS, { s1: { noul: 0.5 } }, 0.8, 3)).toEqual([])
})

test('the note suggests and never orders a load', () => {
  const text = instructionOf([
    { name: 'animate', p: 0.96 },
    { name: 'tdd', p: 0.84 },
  ])
  expect(text).toContain('animate (0.96), tdd (0.84)')
  expect(text).toContain('not an instruction')
  expect(text).toContain('Never load a skill that runs actions or delegates work')
  expect(text).not.toMatch(/\bLoad \S+ with the Skill tool before/)
  expect(instructionOf([])).toBeUndefined()
})

test('a threshold outside 0 to 1 falls back to 0.8', () => {
  expect(thresholdOf(0.9)).toBe(0.9)
  expect(thresholdOf(1)).toBe(1)
  expect(thresholdOf(-1)).toBe(0.8)
  expect(thresholdOf(0)).toBe(0.8)
  expect(thresholdOf(2)).toBe(0.8)
  expect(thresholdOf('0.9')).toBe(0.8)
  expect(thresholdOf(Number.NaN)).toBe(0.8)
})

test('candidates are only listed skills with a description, minus those already loaded', () => {
  const commands = [
    { name: 'tdd', description: 'Test first.' },
    { name: 'animate', description: 'Builds motion.' },
    { name: 'implement', description: 'User-only command.' },
    { name: 'archify', description: '' },
  ]
  const got = candidatesOf(['tdd', 'animate', 'archify'], commands, ['animate'])
  expect(got).toEqual([{ name: 'tdd', description: 'Test first.' }])
})
