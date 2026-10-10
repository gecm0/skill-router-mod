import { expect, test } from 'claude-code/testing'

import { instructionOf, questionsOf, rank, shouldRoute } from '../hooks/route'

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
  const one = rank(SKILLS, { s1: { noul: 0.85 } }, 0.8, 3)
  expect(one).toEqual([{ name: 'tdd', p: 0.85, loaded: true }])
  expect(instructionOf(one)).toContain('tdd (0.85)')
  expect(instructionOf(rank(SKILLS, { s1: { noul: 0.5 } }, 0.8, 3))).toBeUndefined()
})

test('the instruction names loaded skills in order and leaves the rest out', () => {
  const text = instructionOf([
    { name: 'animate', p: 0.96, loaded: true },
    { name: 'tdd', p: 0.84, loaded: true },
    { name: 'slides', p: 0.81, loaded: false },
  ])
  expect(text).toContain('animate (0.96), tdd (0.84)')
  expect(text).not.toContain('slides')
  expect(text).toContain('Skill tool')
})
