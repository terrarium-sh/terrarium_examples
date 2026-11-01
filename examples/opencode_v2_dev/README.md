# OpenCode 2 in a Terra Box

Run [OpenCode 2](https://opencode.ai/v2/docs/) across all your projects inside a
Terra box configured by [`opencode_v2_dev.yaml`](./opencode_v2_dev.yaml).

OpenCode 2 is one server that holds many projects and sessions. The box runs
that server as its workload. The terminal UI, the CLI and the web UI all connect
to it.

The box gets 2 CPUs, 4 GiB of memory and a 4 GiB root filesystem. It can reach
any public address, but not your host or private networks. It has:

- **your projects folder at `/projects`.** OpenCode can open any project in it.
- **OpenCode's config in `.opencode/`** in your projects folder, mounted at
  `/config/opencode`. Edit `opencode.json`, agents and commands there from your
  host. The folder is yours, so it outlives the box, even `terra rm`.
- **an `opencode` volume at `/opencode`.** It holds sessions, sign-ins and
  state. The volume survives restarts and `setup --rebuild`. `terra rm`
  deletes it.
- **the web UI on host loopback only**, at `http://127.0.0.1:4096`, behind a
  pairing link.

Sessions and sign-ins are on a volume, not a host folder, so the agent cannot
reach them through your projects folder. To copy them out, use
`terra opencode_v2_dev sync`. The config is writable from inside the box, so
the agent can change it. Review it before you trust it.

## Set it up

Keep `opencode_v2_dev.yaml` outside your projects folder. The box can write to
everything in that folder, and a box that can edit its own recipe can grant
itself more.

From the folder that holds your projects, for example `~/projects`:

```sh
mkdir -p .opencode                          # OpenCode's config; terra mounts it but won't create it
terra /path/to/opencode_v2_dev.yaml setup   # create the box, install tools and OpenCode 2
terra opencode_v2_dev -d                    # start the OpenCode server in the background
```

The first setup needs network access and takes a little while. The box is named
after the recipe file, `opencode_v2_dev`, and belongs to this projects folder.

If you change the recipe, run `terra opencode_v2_dev stop`, then
`terra /path/to/opencode_v2_dev.yaml setup` again. Add `--rebuild` when you
change `on_create`, so the setup hook runs again. Rebuilding also installs the
latest OpenCode 2. The `opencode` volume is kept.

## Open a project

In the terminal, start the UI on one project:

```sh
terra opencode_v2_dev exec -- opencode /projects/my-app
```

To open the browser UI, run `terra opencode_v2_dev exec -- opencode pair`. It
prints a one-time link that expires after 5 minutes. Open
`http://127.0.0.1:4096` and paste the link. From there, add projects from
`/projects` and switch between their sessions.

## Sign in

The box cannot use the sign-in from your host machine. Type `/connect` in
OpenCode, pick a provider and paste its API key, or run
`terra opencode_v2_dev exec -- opencode auth login`. The sign-in is stored on
the `opencode` volume.

To skip that, add the provider's key to the recipe, for example
`ANTHROPIC_API_KEY`, under `env:` or in an `env_file`. Anything running in the
box can read it. Keep it out of source control.

## Day to day

| Command | What it does |
| --- | --- |
| `terra opencode_v2_dev` | Attach to the server's output; `Ctrl-\` detaches |
| `terra opencode_v2_dev exec -- opencode session list` | List sessions in the current project |
| `terra opencode_v2_dev exec -- sh` | Open a shell beside the server |
| `terra opencode_v2_dev stop` | Stop the box; projects and the volume are kept |
| `terra opencode_v2_dev rm` | Delete the box and its storage, including the volume; `.opencode/` is kept |

OpenCode can run any command in the box. The box is the sandbox. Review
`opencode_v2_dev.yaml` before you use the box with files or data you need to
protect.
