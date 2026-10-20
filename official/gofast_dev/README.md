# GoFast in a Terra Box

Build [GoFast](https://gofast.live/) apps (Go, ConnectRPC, SvelteKit or TanStack
Start, PostgreSQL) inside a Terra box configured by
[`gofast_dev.yaml`](./gofast_dev.yaml). The `gof` CLI comes preinstalled.

The box mounts your project at `/work` and gets 2 CPUs, 4 GiB of memory and an
8 GiB root filesystem. It can reach any public address, but not your host or
private networks. When the box is created, its setup hook installs Go, Node.js,
`make`, `git` and the `gof` CLI. The box opens a `bash` shell in `/work`.

## Set it up

Keep `gofast_dev.yaml` outside the project folder. The box can write to
everything in the project, and a box that can edit its own recipe can grant
itself more.

From the project folder you want to work in:

```sh
terra /path/to/gofast_dev.yaml setup   # create the box, install Go, Node.js and gof
terra gofast_dev                       # start the box; a shell opens in /work
```

The first setup needs network access and takes a little while. The box is named
after the recipe file, `gofast_dev`, and belongs to this project folder.

Press `Ctrl-\` to detach; the shell keeps running. `terra gofast_dev` attaches
again.

If you change the recipe, run `terra gofast_dev stop`, then `terra /path/to/gofast_dev.yaml setup` again. Add
`--rebuild` when you changed `on_create`, so the setup hook runs again. That
also installs the latest `gof`.

## Sign in

GoFast needs an API key, which you get from
[admin.gofast.live](https://admin.gofast.live). Run `gof auth` in the box once
and paste it in. The sign-in is stored in the box and survives restarts.

## Use GoFast

```sh
gof init myapp          # create a project in /work/myapp
cd myapp
gof client svelte       # or: gof client tanstack
gof model note title:string body:string
```

See the [GoFast docs](https://docs.gofast.live/) for the rest of the commands.
Alpine's Go is older than GoFast needs, so `GOTOOLCHAIN=auto` lets Go download
the version a project asks for the first time you build it.

The box has no Docker or PostgreSQL. If a generated project's `make` targets
need them, run those targets on the host, or add the packages to `on_create`.

Other ways to work with the box:

| Command | What it does |
| --- | --- |
| `terra gofast_dev exec -- bash` | Open a second shell |
| `terra gofast_dev stop` | Stop the box (its files are kept) |
| `terra gofast_dev rm` | Delete the box and its storage |
