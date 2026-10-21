# Containers in a Terra Box

Terra boxes boot Terra's own Alpine system, not OCI images. To run a Docker or
OCI image, this box installs [Podman](https://podman.io) and runs the image as
the box's workload. The recipe is [`containers.yaml`](./containers.yaml), and the
example image is `nginx:alpine`, served at `http://127.0.0.1:8080`.

The box gets 2 CPUs, 2 GiB of memory and a 4 GiB root filesystem, and no host
files. It can reach Docker Hub and the Alpine package mirror, and nothing else.
Setup installs Podman and pulls the image, so the first start doesn't have to.

## Set it up

From this folder:

```sh
terra ./containers.yaml setup   # create the box, install Podman, pull the image
terra containers -d             # start it in the background
curl http://127.0.0.1:8080      # nginx answers
```

`terra containers` attaches to the container's output; `Ctrl-\` detaches again.

## Run your own image

Edit [`containers.yaml`](./containers.yaml):

1. Replace `docker.io/library/nginx:alpine` in `on_create` and in
   `workload.args`.
2. Set `network.ports` to the port the image listens on, e.g. `"8080:3000"`.
3. Add any `podman run` flags the image needs to `workload.args` before the
   image name, e.g. `"-e", "KEY=value"` or `"-v", "/data:/data"`.
4. For a registry other than Docker Hub, allow its hosts in `network.allow`.
   For example, GitHub's registry needs `ghcr.io:443` and
   `pkg-containers.githubusercontent.com:443`. Run `terra containers logs` to see
   which hosts were refused.

Then run `terra containers stop && terra ./containers.yaml setup --rebuild` so the
new image is pulled.

## Day to day

| Command | What it does |
| --- | --- |
| `terra containers exec -- sudo podman ps` | List running containers |
| `terra containers exec -- sudo podman run --rm -it docker.io/library/alpine` | Run another image beside the workload |
| `terra containers logs` | Show terra's log, including refused connections |
| `terra containers stop` | Stop the box; pulled images are kept |
| `terra containers rm` | Delete the box and its storage |

## Know the limits

- **Containers share the box's network.** The guest kernel lacks the NAT
  support that Podman's bridge network needs, so the recipe sets
  `netns = "host"`. Two containers can't listen on the same port, and
  `podman run -p` has no effect. Publish ports with `network.ports` instead.
- **No container resource limits.** No cgroup controllers are delegated inside
  the box, so `--memory` and `--cpus` don't work. Size the box with `hw` instead.
- **Containers run as root in the box.** The box is the security boundary, not
  the container. Terra's network allowlist covers every container.
- **Docker Compose files aren't supported.** Run each container with
  `podman run`.
