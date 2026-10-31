#!/bin/sh
# The box's workload, as terri: create the DSH profile on first start, then serve it.
set -e

profile="$HOME/.dsh/profiles/superagent"
if ! grep -qs '"dsh-superagent"' "$profile/package.json"; then
  # Replaces the profile, so only while it has no bundle yet (docs/006-deployment.md, Install).
  dsh superagent --from-default-profile web --dump-config >/dev/null
  cp /opt/box/cordis.patch.yml "$profile/cordis.patch.yml"
  dsh plugin --profile superagent add "link:/opt/dsh-superagent"
fi

# dsh-superagent serves only on 127.0.0.1, while terra delivers the published port to lo:terra-dst.
dst=$(ip -4 -o addr show label lo:terra-dst | awk '{ split($4, a, "/"); print a[1] }')
[ -n "$dst" ] || { echo "start.sh: no lo:terra-dst address; is port 3082 published?" >&2; exit 1; }
socat "TCP-LISTEN:3082,bind=$dst,fork,reuseaddr" TCP:127.0.0.1:3082 &

exec dsh --profile superagent --no-open
