# dsh-superagent in a Terra Box

> **Unofficial sample.** [dsh-superagent](https://github.com/deepseek-ai/dsh-superagent-prototype)
> is DeepSeek's research prototype, "for reference only, not an official
> DeepSeek product". Neither it nor this recipe is maintained by the Terrarium
> team. Read the upstream README before you trust it with a repository.

dsh-superagent is a proactive coding agent for one GitHub repository, built as
a bundle for [DeepSeek Harness](https://www.deepseek.com/en/harness/) (DSH).
Someone on its allowed list mentions the agent's GitHub account on an issue.
The agent opens a Ticket, works on it in its own DSH Session and directory,
and answers in that thread, for example with a pull request. A web panel shows
what needs a person.

Upstream runs it as your own OS user with `danger-full-access`, and warns that
a worker "can read the operator's home directory". This box gives it a
machine of its own instead:

- **The model is [OpenCode Go](https://opencode.ai) with DeepSeek V4.1 Flash**
  (`opencode-go/deepseek-v4.1-flash`), through DSH's pi-ai adapter. You bring
  the key.
- **No host files**, except `box/` (the start script and the profile patch),
  which is read-only.
- **Six network destinations**: the model (`opencode.ai`), GitHub (`github.com`,
  `api.github.com`, `objects.githubusercontent.com`), and the Alpine and npm
  registries that setup needs.
- **Its own disk.** The `home` volume at `/home/terri` holds the DSH profile,
  the database, the Ticket directories, the agent's GitHub sign-in and your
  repository clone. It survives restarts and `setup --rebuild`.
- **The panel on host loopback only**, at `http://127.0.0.1:3082`, behind
  DSH's login token.

Pinned versions: dsh-superagent at upstream commit `6337fc8`, `@deepseek-ai/dsh@0.2.1-rc.3`
and `pnpm@11.7.0`.

## Set it up

1. Copy this folder somewhere of your own and add your OpenCode Go key:

   ```sh
   cp -r examples/dsh_superagent ~/dsh_superagent && cd ~/dsh_superagent
   cp .env.example .env   # then set OPENCODE_API_KEY
   ```

   Give the key a spend limit. Anything running in the box can read it.

2. Create the box. This installs Node.js, git, the GitHub CLI and DSH, then
   builds dsh-superagent. It takes a few minutes:

   ```sh
   terra setup
   ```

3. Start it in the background:

   ```sh
   terra -d
   ```

   The first start creates the DSH profile `superagent` from DSH's Web
   template and applies [`box/cordis.patch.yml`](box/cordis.patch.yml).

## Give the agent a GitHub account

The agent acts as a **dedicated GitHub user account**, never yours. Everything
it writes appears under that name. Create the account, give it write access to
the repository and accept the invitation as that account. A GitHub App won't
work, because the agent reads the account's notifications.

Then sign the box's `gh-agent` wrapper in as that account. `gh-agent` is `gh`
with its own config directory on the volume:

```sh
terra dsh_superagent exec -t -- gh-agent auth login   # GitHub.com, HTTPS, login with a web browser
terra dsh_superagent exec -- gh-agent api user --jq .login
```

The second command must print the agent's login. Clone the repository for the
Tickets to check out from:

```sh
terra dsh_superagent exec -- gh-agent repo clone acme/widgets /home/terri/src/widgets
```

## Configure it in the panel

Run `terra` to attach. DSH prints its URL with a fresh login token on each
start, `dsh web: http://127.0.0.1:3082/?token=...`. Open it on the host, choose
**Superagent** in the sidebar, then:

1. **Sources → GitHub**: the repository (`acme/widgets`) and the agent CLI,
   `/usr/local/bin/gh-agent`.
2. **Policy → On each Source**: the GitHub logins that may ask the agent for
   work. Until this list has someone, nothing becomes a Ticket. Start with
   yourself.
3. **Execution**: the prepare command, which gives each Ticket a worktree of
   your clone:

   ```sh
   git -C /home/terri/src/widgets fetch --no-tags "https://github.com/$DSH_SUPERAGENT_GITHUB_REPOSITORY.git" "${DSH_SUPERAGENT_GITHUB_PR_HEAD:-HEAD}:refs/dsh-superagent/$DSH_SUPERAGENT_TICKET" &&
   git -C /home/terri/src/widgets worktree add -b "agent/$DSH_SUPERAGENT_NAME" "$DSH_SUPERAGENT_DIR" "refs/dsh-superagent/$DSH_SUPERAGENT_TICKET"
   ```

4. **Prompts**: the commit author and the auto-merge rule, under Delivery
   requirements. Leave auto-merge off until the agent's pull requests have
   been right for a while.

Accept mode starts as `observe`: proactive work is recorded, not done. The
upstream [docs](https://github.com/deepseek-ai/dsh-superagent-prototype/tree/main/docs)
explain every setting. Read them in order. [006 Deployment](https://github.com/deepseek-ai/dsh-superagent-prototype/blob/main/docs/006-deployment.md)
also covers the management API, which `SETUP.md` drives.

## Try it

From an allowed account, comment `@<agent login> <request>` on an issue. A
Ticket shows up on the panel's overview within about a minute. The agent
acknowledges the request, works in `/home/terri/.dsh/state/superagent/work`,
and answers in the issue.

`Ctrl-\` detaches and leaves the agent running.

## Change the model

The profile patch is copied to `/home/terri/.dsh/profiles/superagent/cordis.patch.yml`
on the first start only, so edit that copy, then restart the box:

```sh
terra dsh_superagent exec -- vi /home/terri/.dsh/profiles/superagent/cordis.patch.yml
terra dsh_superagent stop && terra -d
```

- **Another OpenCode Go model:** replace `deepseek-v4.1-flash` both in the
  `opencode-go` models list and in `agent-default-model`, e.g. `deepseek-v4-pro`
  or `kimi-k3`. The panel's Eval and Execution settings can also name a model
  per role.
- **Another provider:** add its route under `llm-pi-ai` (see the
  [pi-ai adapter README](https://www.npmjs.com/package/@deepseek-ai/dsh-llm-pi-ai)),
  put its key in `.env`, and allow its host in `network.allow`.

## Day to day

| Command | What it does |
| --- | --- |
| `terra` | Attach to DSH's output, including the panel URL |
| `terra dsh_superagent exec -- sh` | Open a shell in the box |
| `terra dsh_superagent sync :/home/terri/.dsh/state/superagent/orchestrator.sqlite .` | Back up the database, e.g. before an upgrade |
| `terra dsh_superagent logs` | Show terra's log, including refused connections |
| `terra dsh_superagent stop` | Stop the box; settings, Tickets and sign-ins are kept |
| `terra dsh_superagent rm` | Delete the box and its volume, including the database and the agent's sign-in |

**Upgrade:** wait until no Ticket is mid-turn, back up the database, change the
pinned commit in `on_create`, then `terra dsh_superagent stop && terra setup --rebuild`.
A database migrated by a newer version can't be opened by an older one.

## Know the limits

- **The agent can run anything in the box,** as `terri`, with the agent's
  GitHub token and your OpenCode key in reach. The box is the sandbox. The
  allowlist keeps it off the rest of the internet, which also means no
  installs from other registries. If your repository's tests need npm, PyPI or
  another registry, allow its hosts in `dsh_superagent.yaml`.
- **The web search tool doesn't work.** DSH's Web profile searches through
  DeepSeek's own API, which this box neither allows nor has a key for.
- **No Feishu.** Enable `dsh-superagent-feishu` in the profile patch, install
  `lark-cli` and allow the Feishu or Lark API host if you want it.
- **No hourly check.** Upstream's `scripts/dsh-superagent` and its tmux-based
  watchdog are left out. The box runs DSH as its workload, so if DSH exits the
  box stops. Start it again with `terra -d`.
- **`terra logs` shows a refused lookup of `dsh-superagent`**, the box's own
  hostname. It is harmless.
- **Research code.** Upstream may change or disappear. The recipe pins one
  commit for that reason.
