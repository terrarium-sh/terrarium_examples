# pi-durable Assistant in a Terra Box

[pi-durable](https://www.npmjs.com/package/@earendil-works/pi-durable) is the
experimental durable agent harness from [pi.dev](https://pi.dev). It writes
every message, model turn and tool call to storage before showing it, so an
agent that is killed mid-answer picks up where it stopped on the next start.

This box runs a small chat assistant built on it,
[`app/agent.mjs`](app/agent.mjs) (about 110 lines). It talks to any
OpenAI-compatible API, by default [OpenCode Go](https://opencode.ai) with
DeepSeek V4.1 Flash. It has pi-durable's `read`, `write`, `edit` and `bash` tools, and
keeps everything in one SQLite file. The box gets:

- **no host files** except `app/`, which is read-only. The agent can read its
  own code but not change it.
- **three network destinations**: the model API (OpenCode Go at
  `opencode.ai`), plus the Alpine and npm registries that setup needs.
- **its own disk.** The conversation database (`/data/agent.sqlite`) and the
  agent's workspace (`/data/work`) live on the `data` volume, which survives
  restarts and `setup --rebuild`.

## Set it up

1. Copy this folder somewhere of your own and add your key:

   ```sh
   cp -r official/pi_durable ~/pi_durable && cd ~/pi_durable
   cp .env.example .env   # then set OPENAI_API_KEY
   ```

   Give the key a spend limit. Anything running in the box can read it.

2. Create the box. This installs Node.js and pi-durable, which takes under a
   minute:

   ```sh
   terra setup
   ```

3. Start it and chat:

   ```sh
   terra
   ```

   Try `write a shell script that prints the first 20 primes, then run it`.
   Each tool call shows up as `[bash] {...}` with the first line of its result
   under it, then the answer.

`Ctrl-\` detaches and leaves the assistant running; `terra` attaches again.
`Ctrl-D` quits the assistant, which stops the box.

## See it survive a crash

1. Ask for something that takes a while, e.g. `write a 2000 word story to story.md`.
2. While it works, from another terminal: `terra pi_durable stop`.
3. Run `terra` again.

The conversation is printed back from the database and the unfinished run
continues by itself. A tool call that was cut off isn't silently rerun: the
model gets an error result holding the output so far, and decides what to do.

## Change the agent

`app/` is mounted, not copied, so edit [`app/agent.mjs`](app/agent.mjs) and
restart the box (`terra pi_durable stop`, then `terra`). No rebuild needed.

- **Another model:** set `AGENT_MODEL` in `.env` (default
  `deepseek-v4.1-flash`), e.g. `AGENT_MODEL=glm-5.3` or `AGENT_MODEL=kimi-k3`
  on OpenCode Go.
- **Another OpenAI-compatible API** (OpenAI, OpenRouter, a vLLM or Ollama
  server, ...): set `OPENAI_BASE_URL`, `OPENAI_API_KEY` and `AGENT_MODEL` in
  `.env`, and replace `opencode.ai:443` in `network.allow` with its host. For
  example `OPENAI_BASE_URL=https://openrouter.ai/api/v1` needs
  `openrouter.ai:443`.
- **More tools:** add `defineTool()`s to the `assistant` extension. See the
  [pi-durable README](https://github.com/earendil-works/pi/tree/main/packages/durable).
- **Another pi-durable version:** change the pinned versions in `on_create`,
  then `terra pi_durable stop && terra setup --rebuild`. pi-durable is
  experimental and its API changes between releases.

## Day to day

| Command | What it does |
| --- | --- |
| `terra pi_durable exec -- sh` | Open a shell in the box, e.g. to look at `/data/work` |
| `terra pi_durable sync :/data/work ./work` | Copy the agent's workspace to the host |
| `terra pi_durable logs` | Show terra's log, including refused connections |
| `terra pi_durable stop` | Stop the box; the conversation and workspace are kept |
| `terra pi_durable rm` | Delete the box, its database and workspace |

To start a fresh conversation, delete the database:
`terra pi_durable exec -- rm /data/agent.sqlite`, then restart the box.

## Know the limits

- **One conversation, one process.** The app uses pi-durable's root
  conversation. Don't run a second copy against the same database.
- **`bash` runs anything inside the box.** The box is the sandbox. The
  allowlist keeps the agent off the rest of the internet, which also means no
  `apk add` or `pip install` once setup is done. Allow the hosts it needs if
  you want that.
- **Experimental.** pi-durable is pinned to `1.4.0` because its API changes
  without notice.
