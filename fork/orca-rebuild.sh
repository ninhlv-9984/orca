#!/usr/bin/env bash
# Rebuild the fork: rebase the patch branch onto the newest upstream stable tag
# (or the tag given as $1), build, and install the result on this machine.
#
#   orca-rebuild            # newest upstream vX.Y.Z
#   orca-rebuild v1.4.221   # a specific upstream tag
#
# On a rebase conflict it stops: resolve, `git rebase --continue`, rerun.
# rerere is enabled, so a conflict resolved once is replayed automatically.
set -euo pipefail

REPO="${ORCA_FORK_DIR:-$HOME/Desktop/work/personal/orca}"
BRANCH="${ORCA_FORK_BRANCH:-ninh/patches}"
cd "$REPO"

if [[ -n "$(git status --porcelain)" ]]; then
  echo "orca-rebuild: $REPO has uncommitted changes; commit or stash them first." >&2
  exit 1
fi
git config rerere.enabled true
git switch -q "$BRANCH"
git fetch -q upstream --tags

old=$(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' HEAD)
new=${1:-$(git tag -l 'v[0-9]*' --sort=-v:refname | grep -v -- - | head -1)}

if [[ "$old" != "$new" ]]; then
  echo "==> rebasing $BRANCH: $old -> $new"
  if ! git rebase --onto "$new" "$old" "$BRANCH"; then
    echo "orca-rebuild: conflict while rebasing onto $new." >&2
    echo "  resolve the files, git add them, git rebase --continue, then rerun orca-rebuild." >&2
    echo "  (git rebase --skip drops a patch upstream already covers; git rebase --abort backs out.)" >&2
    exit 1
  fi
  git range-diff "$old..ORIG_HEAD" "$new..HEAD" || true
  git push -q --force-with-lease origin "$BRANCH"
else
  echo "==> $BRANCH already on $new"
fi

echo "==> installing dependencies"
pnpm install --frozen-lockfile
(cd mobile && pnpm install --frozen-lockfile)

echo "==> typechecking"
pnpm tc

# Tests of every file the fork commits touch: touched tests themselves, plus
# the sibling foo.test.ts(x) / foo.*.test.ts(x) of each touched source file.
echo "==> testing fork patches"
mapfile -t touched < <(git diff --name-only "$new"..HEAD)
declare -A seen=()
tests=()
add_test() {
  [[ -f "$1" && -z "${seen[$1]:-}" ]] || return 0
  seen[$1]=1
  tests+=("$1")
}
for f in "${touched[@]}"; do
  [[ "$f" == src/* && "$f" =~ \.tsx?$ && -f "$f" ]] || continue
  if [[ "$f" =~ \.test\.tsx?$ ]]; then
    add_test "$f"
    continue
  fi
  base="${f%.*}" ext="${f##*.}"
  shopt -s nullglob
  for t in "$base.test.$ext" "$base".*.test.ts "$base".*.test.tsx; do
    add_test "$t"
  done
  shopt -u nullglob
done
if ((${#tests[@]} == 0)); then
  echo "orca-rebuild: no tests relate to fork-touched files; skipping."
else
  echo "    ${#tests[@]} test files"
  pnpm exec vitest run --config config/vitest.config.ts "${tests[@]}"
fi

export NODE_OPTIONS="--max-old-space-size=4096"
rm -rf dist
echo "==> building"
pnpm build:desktop

case "$(uname -s)" in
  Linux)
    arch=$([[ "$(uname -m)" == aarch64 ]] && echo arm64 || echo x64)
    pnpm run ensure:electron-runtime
    ORCA_FORK_SKIP_GLIBC_FLOOR=1 \
      pnpm exec electron-builder --config config/electron-builder.config.cjs --linux deb "--$arch"
    deb=$(ls dist/orca-ide_*.deb)
    echo "==> installing $deb"
    sudo apt install -y --reinstall "./$deb"
    ;;
  Darwin)
    arch=$([[ "$(uname -m)" == arm64 ]] && echo arm64 || echo x64)
    pnpm build:computer-macos
    pnpm build:keyboard-layout-macos
    pnpm build:notification-status-macos
    pnpm run ensure:electron-runtime
    pnpm exec electron-builder --config config/electron-builder.config.cjs --mac dir "--$arch"
    app=$(ls -d dist/mac*/Orca.app | head -1)
    if pgrep -xq Orca; then
      echo "orca-rebuild: built $app but Orca is running; quit it and copy it to /Applications." >&2
      exit 1
    fi
    echo "==> installing $app -> /Applications/Orca.app"
    rm -rf /Applications/Orca.app
    ditto "$app" /Applications/Orca.app
    ;;
  *)
    echo "orca-rebuild: unsupported OS $(uname -s)" >&2
    exit 1
    ;;
esac

echo "==> done: Orca $(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' HEAD) + $(git rev-list --count "$new..HEAD") fork patches"
