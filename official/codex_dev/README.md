# Codex in a Terra Box

This README was created with **Codex**, running inside a **Terra box** configured by [`codex_dev.yaml`](./codex_dev.yaml).

The box mounts this project at `/work`, provides 2 CPUs, 4 GiB of memory, and a 4 GiB root filesystem, and has unrestricted public network access. When the box is created, its setup hook installs common command-line tools and Codex CLI. Codex starts in `/work` with the sandbox and approval settings defined in the configuration.

## Set it up

1. Put `codex_dev.yaml` in the project folder you want to use. The configuration mounts that folder into the box at `/work`.
2. Create or start a Terra box using this configuration. The `on_create` hook installs `bash`, `ca-certificates`, `curl`, `git`, `ripgrep`, and Codex CLI. The first setup therefore needs network access and may take a little time.
3. Once setup finishes, the configured entrypoint launches Codex in `/work`.

If you change the `on_create` setup commands, recreate the box (or otherwise rerun its setup hook) for those changes to take effect.

## Sign in

Because the box is an isolated environment, it may not be able to use a sign-in session from your host machine. If you are not supplying an API key, sign in with **device code authentication**: start Codex in the box, choose the device-code sign-in option when prompted, then follow the instructions to open the displayed URL on a device with a browser and enter the code. Complete sign-in there; Codex can then use the resulting authentication in the box.

Alternatively, provide an API key to the box through your environment or secret-injection mechanism, and make it available to Codex as `OPENAI_API_KEY`. Keep the key private and out of source control.

## Run Codex

The configuration starts Codex automatically. If you need to start it again from a shell inside the box, run:

```sh
cd /work
codex
```

Codex runs with the configured `--sandbox danger-full-access` and `--ask-for-approval on-request` options. Review those settings in `codex_dev.yaml` before using the box with files or data you need to protect.
