# statusline-toggle

`/sl` toggles your Claude Code status line on and off. It runs locally — no model turn, no tokens — and works mid-response.

[中文说明](#中文说明)

## Install

At the prompt of a Claude Code session:

```
/plugin install statusline-toggle --marketplace Miaaanz/statusline-toggle
```

Answer `y` to add the marketplace, then pick a scope. From a shell instead:

```
claude plugin install statusline-toggle --marketplace Miaaanz/statusline-toggle
```

## Setup (once)

Claude Code has no switch for the status line itself, so `/sl` writes a flag file and your status line script checks it.

### No status line yet: `/sl setup`

Run `/sl setup` once. It copies the bundled status line ([`examples/statusline-command.sh`](examples/statusline-command.sh): directory, git branch, model, and right-aligned context usage and reasoning effort) to `~/.claude/statusline-command.sh` and adds it to `~/.claude/settings.json` with a one-second refresh. It shows up within a second; if not, restart Claude Code.

It never replaces a status line you already have: if `settings.json` has one, it changes nothing and prints the steps below. A different file already at `statusline-command.sh` is kept as `statusline-command.sh.bak`.

### Keeping your own status line: by hand

**1. Add one line to your status line script**, right after it reads stdin:

```bash
input=$(cat)
[ "$(cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline-state" 2>/dev/null)" = "off" ] && exit 0
```

**2. Make the status line refresh every second** in `~/.claude/settings.json`, so a toggle shows up right away instead of on the next message:

```json
"statusLine": {
  "type": "command",
  "command": "bash ~/.claude/statusline-command.sh",
  "refreshInterval": 1
}
```

## Usage

Type `/sl` (`/sl setup` for the one-time setup above). It answers `Status line off` or `Status line on`, and the status line follows within a second.

The state is kept in `~/.claude/statusline-state` (or `$CLAUDE_CONFIG_DIR/statusline-state`), so it carries over to new sessions. To turn the status line back on by hand: `printf on > ~/.claude/statusline-state`.

## Uninstall

**Turn the status line on first** (`/sl` until it says `Status line on`). The plugin cannot clean up after itself, so uninstalling while it is off leaves your status line hidden.

```
claude plugin uninstall statusline-toggle
claude plugin marketplace remove statusline-toggle   # optional: drop the marketplace too
```

Or uninstall it from the `/plugin` menu inside a session. Then, optionally, undo the setup: delete `~/.claude/statusline-state`, the `statusline-state` line in your status line script, and `"refreshInterval"` in `settings.json`. Left in place they do nothing.

## Notes

- On Windows the status line command runs through Git Bash (`bash`).
- An "off" status line prints nothing; how Claude Code lays out an empty status line is up to Claude Code.

---

## 中文说明

`/sl` 一键开关 Claude Code 的状态栏。命令在本地执行，不经过模型、不消耗 token，模型回复过程中也能用。

### 安装

在 Claude Code 里输入：

```
/plugin install statusline-toggle --marketplace Miaaanz/statusline-toggle
```

按 `y` 添加插件市场，再选安装范围。

### 配置（只需一次）

Claude Code 本身没有状态栏开关，`/sl` 是通过写一个标记文件，由你的状态栏脚本读取来实现的。

**还没有状态栏：执行 `/sl setup`**

执行一次 `/sl setup`，它会把自带的状态栏脚本（[`examples/statusline-command.sh`](examples/statusline-command.sh)：显示目录、git 分支、模型，右侧显示上下文用量和 effort）复制到 `~/.claude/statusline-command.sh`，并写入 `~/.claude/settings.json`，每秒刷新。1 秒内出现，没出现就重启 Claude Code。

它不会覆盖你已有的状态栏：`settings.json` 里已经有 `statusLine` 时什么都不改，只提示下面的手动步骤。`statusline-command.sh` 已存在且内容不同时，原文件会备份为 `statusline-command.sh.bak`。

**保留自己的状态栏：手动配置**

1. 在状态栏脚本读取 stdin 之后加一行：

   ```bash
   [ "$(cat "${CLAUDE_CONFIG_DIR:-$HOME/.claude}/statusline-state" 2>/dev/null)" = "off" ] && exit 0
   ```

2. 在 `~/.claude/settings.json` 的 `statusLine` 里加 `"refreshInterval": 1`，让状态栏每秒刷新，切换后立刻生效，不用等下一条消息。

### 使用

输入 `/sl`，提示 `Status line off` / `Status line on`，状态栏 1 秒内跟着变化。状态保存在 `~/.claude/statusline-state`，新会话沿用。手动恢复：`printf on > ~/.claude/statusline-state`。

### 卸载

**先把状态栏打开**（执行 `/sl` 直到提示 `Status line on`）。插件无法在卸载时自动收尾，关着状态卸载的话，状态栏会一直隐藏。

```
claude plugin uninstall statusline-toggle
claude plugin marketplace remove statusline-toggle   # 可选：同时移除插件市场
```

也可以在会话里通过 `/plugin` 菜单卸载。之后可选清理：删除 `~/.claude/statusline-state`、状态栏脚本里那行 `statusline-state` 检查、`settings.json` 里的 `"refreshInterval"`。不删也没有影响。

## License

[MIT](LICENSE)
