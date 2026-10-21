import { expect, test } from 'claude-code/testing'

import * as lib from './lib'

const BLOCK = `${lib.OPEN}\n## Map\n- docs/plans/\n${lib.CLOSE}`
const OLD = `${lib.OPEN}\n## Map\n- old\n${lib.CLOSE}`

test('a missing CLAUDE.md is created with the block alone', () => {
  const p = lib.plan(undefined, BLOCK)
  expect(p.action).toBe('created')
  expect(p.text).toBe(`${BLOCK}\n`)
})

test('a CLAUDE.md without the block gets it prepended, content kept', () => {
  const p = lib.plan('# Project\n\nNotes.\n', BLOCK)
  expect(p.action).toBe('inserted')
  expect(p.text).toBe(`${BLOCK}\n\n# Project\n\nNotes.\n`)
})

test('an outdated block is replaced and everything around it kept byte for byte', () => {
  const before = '# Intro\n\n'
  const after = '\n\n## Tools\n- x\n'
  const p = lib.plan(`${before}${OLD}${after}`, BLOCK)
  expect(p.action).toBe('updated')
  expect(p.text).toBe(`${before}${BLOCK}${after}`)
})

test('a current block leaves the file unchanged', () => {
  const text = `${BLOCK}\n\n## Tools\n`
  const p = lib.plan(text, BLOCK)
  expect(p.action).toBe('unchanged')
  expect(p.text).toBe(text)
  expect(p.legacyRemoved).toBe(false)
})

test('the legacy pipeline import is removed in every case', () => {
  const p = lib.plan(`${BLOCK}\n${lib.LEGACY_IMPORT}\n## Tools\n`, BLOCK)
  expect(p.action).toBe('unchanged')
  expect(p.legacyRemoved).toBe(true)
  expect(p.text).toBe(`${BLOCK}\n## Tools\n`)
})

test('tags count only alone on their own line', () => {
  expect(lib.extractBlock(`See the ${lib.OPEN} block.\n`)).toBeUndefined()
  expect(lib.extractBlock(`  ${lib.OPEN}\nx\n  ${lib.CLOSE}\n`)).toBeUndefined()
  expect(lib.extractBlock(`${lib.OPEN}\nunclosed\n`)).toBeUndefined()
  expect(lib.extractBlock(`a\n${BLOCK}\nb`)).toBe(BLOCK)
})

test('the nested configuration-guide tags do not end the block', () => {
  const nested = `${lib.OPEN}\n<configuration-guide>\n- x\n</configuration-guide>\n${lib.CLOSE}`
  expect(lib.extractBlock(`${nested}\n## after\n`)).toBe(nested)
})
