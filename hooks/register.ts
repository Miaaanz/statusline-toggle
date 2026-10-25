import type { Register } from 'claude-code'

// The Claude config dir: $CLAUDE_CONFIG_DIR, else ~/.claude (forward slashes, which
// Windows accepts too, so messages show one style)
const slashes = (path: string) => path.replace(/\\/g, '/').replace(/\/+$/, '')
const configDirOf = (configDir?: string, home?: string) => {
  if (configDir) return { dir: slashes(configDir), isDefault: false }
  if (home) return { dir: `${slashes(home)}/.claude`, isDefault: true }

  return undefined
}

const SCRIPT = 'statusline-command.sh'
const FLAG_LINE =
  'read -r sl_state 2>/dev/null < "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline-state"; [ "$sl_state" = "off" ] && exit 0'
const USAGE = 'Usage: /sl (toggle the status line) | /sl setup (install the bundled status line)'

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'sl',
      description: 'Toggle the status line on/off; /sl setup installs it',
      argumentHint: '[setup]',
      immediate: true,
    })

    return next(e)
  })

  on('command.run', { command: 'sl' }, async ($, e) => {
    const config = configDirOf(
      await $.env.get('CLAUDE_CONFIG_DIR'),
      (await $.env.get('HOME')) ?? (await $.env.get('USERPROFILE')),
    )
    if (!config) return { text: 'Cannot find the home directory (HOME / USERPROFILE unset)' }

    const args = (e.args ?? '').trim()

    if (args === '') {
      const flag = `${config.dir}/statusline-state`
      const current = (await $.fs.exists(flag)) ? (await $.fs.read(flag)).trim() : 'on'
      const nextState = current === 'off' ? 'on' : 'off'
      await $.fs.write(flag, nextState)

      return { text: nextState === 'on' ? 'Status line on' : 'Status line off' }
    }

    if (args !== 'setup') return { text: USAGE }

    // /sl setup: copy the bundled script and point settings.json at it, but never
    // replace a status line the person already has
    const settingsPath = `${config.dir}/settings.json`
    const scriptPath = `${config.dir}/${SCRIPT}`
    const command = config.isDefault ? `bash ~/.claude/${SCRIPT}` : `bash "${scriptPath}"`

    let settings: Record<string, unknown> = {}
    if (await $.fs.exists(settingsPath)) {
      try {
        const parsed: unknown = JSON.parse(await $.fs.read(settingsPath))
        if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('not an object')
        settings = parsed as Record<string, unknown>
      } catch {
        return {
          text: `Could not parse ${settingsPath}, so nothing was changed. Fix the file, or add the status line by hand (see the README).`,
        }
      }
    }

    const existing = settings.statusLine as { command?: unknown; refreshInterval?: unknown } | undefined
    if (existing !== undefined) {
      const current = typeof existing.command === 'string' ? existing.command : JSON.stringify(existing)
      if (current === command && existing.refreshInterval !== undefined) {
        return { text: 'Already set up: the bundled status line is in use. /sl toggles it.' }
      }

      return {
        text: [
          `You already have a status line, so it was left unchanged:`,
          `  ${current}`,
          `To make /sl toggle it, add this line to that script right after it reads stdin:`,
          `  ${FLAG_LINE}`,
          `and add "refreshInterval": 1 to "statusLine" in ${settingsPath}.`,
          `To use the bundled status line instead, remove "statusLine" from settings.json and run /sl setup again.`,
        ].join('\n'),
      }
    }

    const bundled = await $.fs.read(`${$.plugin.root}/examples/${SCRIPT}`)
    let backup = ''
    if (await $.fs.exists(scriptPath)) {
      const old = await $.fs.read(scriptPath)
      if (old !== bundled) {
        backup = `${scriptPath}.bak`
        await $.fs.write(backup, old)
      }
    }
    await $.fs.write(scriptPath, bundled)

    settings.statusLine = { type: 'command', command, refreshInterval: 1 }
    await $.fs.write(settingsPath, `${JSON.stringify(settings, null, 2)}\n`)

    return {
      text: [
        `Status line set up: ${scriptPath}`,
        backup ? `Your previous ${SCRIPT} was saved as ${backup}.` : '',
        'It should appear within a second; if not, restart Claude Code. /sl toggles it.',
      ]
        .filter(Boolean)
        .join('\n'),
    }
  })
}
