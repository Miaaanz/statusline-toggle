import { expect, mock, test } from 'claude-code/testing'

type On = Parameters<Parameters<typeof test>[1]>[1]

// The engine resolves paths for the host OS before they reach the hooks, so the
// in-memory file system keys them with forward slashes and no drive letter
const norm = (path: string) => path.replace(/\\/g, '/').replace(/^[A-Za-z]:/, '')

const BUNDLED = '#!/bin/bash\n# bundled status line\n'

const memoryFs = (on: On, initial: Record<string, string> = {}) => {
  const files = new Map<string, string>(Object.entries(initial))
  const writes: string[] = []
  on('fs.exists', async (_, e) => ({ value: files.has(norm(e.path)) || norm(e.path).endsWith('/examples/statusline-command.sh') }))
  on('fs.read', async (_, e) => {
    const path = norm(e.path)
    if (path.endsWith('/examples/statusline-command.sh')) return { value: BUNDLED }
    if (!files.has(path)) throw new Error(`ENOENT: ${path}`)

    return { value: files.get(path) ?? '' }
  })
  on('fs.write', async (_, e) => {
    files.set(norm(e.path), e.text)
    writes.push(norm(e.path))

    return { value: undefined }
  })

  return { files, writes }
}

const HOME = '/home/u'
const SETTINGS = '/home/u/.claude/settings.json'
const SCRIPT = '/home/u/.claude/statusline-command.sh'
const FLAG = '/home/u/.claude/statusline-state'

const settingsOf = (files: Map<string, string>) => JSON.parse(files.get(SETTINGS) ?? '{}')

test('/sl flips the flag off and on under ~/.claude', async ($, on) => {
  mock.env(on, { HOME })
  const { files } = memoryFs(on)

  const first = await $.command.run({ command: 'sl' })
  expect(first.text).toBe('Status line off')
  expect(files.get(FLAG)).toBe('off')

  const second = await $.command.run({ command: 'sl' })
  expect(second.text).toBe('Status line on')
  expect(files.get(FLAG)).toBe('on')
})

test('/sl uses CLAUDE_CONFIG_DIR when set', async ($, on) => {
  mock.env(on, { CLAUDE_CONFIG_DIR: '/cfg/', HOME })
  const { files } = memoryFs(on)

  await $.command.run({ command: 'sl' })
  expect([...files.keys()]).toEqual(['/cfg/statusline-state'])
})

test('/sl falls back to USERPROFILE on Windows', async ($, on) => {
  mock.env(on, { USERPROFILE: 'C:\\Users\\u' })
  const { files } = memoryFs(on)

  await $.command.run({ command: 'sl' })
  expect([...files.keys()]).toEqual(['/Users/u/.claude/statusline-state'])
})

test('/sl reports a missing home directory instead of writing', async ($, on) => {
  mock.env(on, {})
  const { writes } = memoryFs(on)

  const ran = await $.command.run({ command: 'sl' })
  expect(ran.text).toBe('Cannot find the home directory (HOME / USERPROFILE unset)')
  expect(writes).toEqual([])
})

test('/sl with an unknown argument shows usage and writes nothing', async ($, on) => {
  mock.env(on, { HOME })
  const { writes } = memoryFs(on)

  const ran = await $.command.run({ command: 'sl', args: 'foo' })
  expect(ran.text?.startsWith('Usage: /sl')).toBe(true)
  expect(writes).toEqual([])
})

test('/sl setup installs the script and status line, keeping other settings', async ($, on) => {
  mock.env(on, { HOME })
  const { files } = memoryFs(on, { [SETTINGS]: JSON.stringify({ model: 'opus', env: { A: '1' } }) })

  const ran = await $.command.run({ command: 'sl', args: 'setup' })
  expect(ran.text?.startsWith(`Status line set up: `)).toBe(true)
  expect(files.get(SCRIPT)).toBe(BUNDLED)
  expect(settingsOf(files)).toEqual({
    model: 'opus',
    env: { A: '1' },
    statusLine: { type: 'command', command: 'bash ~/.claude/statusline-command.sh', refreshInterval: 1 },
  })
})

test('/sl setup creates settings.json when there is none', async ($, on) => {
  mock.env(on, { HOME })
  const { files } = memoryFs(on)

  await $.command.run({ command: 'sl', args: ' setup ' })
  expect(settingsOf(files).statusLine.command).toBe('bash ~/.claude/statusline-command.sh')
})

test('/sl setup backs up a different script already at that path', async ($, on) => {
  mock.env(on, { HOME })
  const { files } = memoryFs(on, { [SCRIPT]: 'old script' })

  const ran = await $.command.run({ command: 'sl', args: 'setup' })
  expect(files.get(`${SCRIPT}.bak`)).toBe('old script')
  expect(files.get(SCRIPT)).toBe(BUNDLED)
  expect(ran.text).toContain('.bak')
})

test('/sl setup leaves an existing status line alone', async ($, on) => {
  mock.env(on, { HOME })
  const original = JSON.stringify({ statusLine: { type: 'command', command: 'my-line.sh' } })
  const { files, writes } = memoryFs(on, { [SETTINGS]: original })

  const ran = await $.command.run({ command: 'sl', args: 'setup' })
  expect(ran.text).toContain('You already have a status line')
  expect(ran.text).toContain('my-line.sh')
  expect(writes).toEqual([])
  expect(files.get(SETTINGS)).toBe(original)
})

test('/sl setup a second time says it is already set up', async ($, on) => {
  mock.env(on, { HOME })
  const { writes } = memoryFs(on)

  await $.command.run({ command: 'sl', args: 'setup' })
  const count = writes.length
  const ran = await $.command.run({ command: 'sl', args: 'setup' })
  expect(ran.text?.startsWith('Already set up')).toBe(true)
  expect(writes.length).toBe(count)
})

test('/sl setup refuses to touch a settings.json it cannot parse', async ($, on) => {
  mock.env(on, { HOME })
  const { writes } = memoryFs(on, { [SETTINGS]: '{ "model": "opus", ' })

  const ran = await $.command.run({ command: 'sl', args: 'setup' })
  expect(ran.text).toContain('Could not parse')
  expect(writes).toEqual([])
})

test('/sl setup under CLAUDE_CONFIG_DIR points the command at that dir', async ($, on) => {
  mock.env(on, { CLAUDE_CONFIG_DIR: '/cfg', HOME })
  const { files } = memoryFs(on)

  await $.command.run({ command: 'sl', args: 'setup' })
  const settings = JSON.parse(files.get('/cfg/settings.json') ?? '{}')
  expect(norm(settings.statusLine.command)).toContain('/cfg/statusline-command.sh"')
  expect(files.get('/cfg/statusline-command.sh')).toBe(BUNDLED)
})
