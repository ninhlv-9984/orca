#!/usr/bin/env bash
# Rebuild the fork: rebase the patch branch onto an upstream target, build, and
# install the result on this machine.
#
#   orca-rebuild            # stay on the current track: upstream/main if the
#                           # branch is based on it, else the newest vX.Y.Z
#   orca-rebuild v1.4.221   # a specific upstream tag (switches back to releases)
#   orca-rebuild main       # upstream/main, unreleased (version X.Y.Z+1-main.DATE.gSHA)
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
# Why: PRs merge into origin/$BRANCH on GitHub, so local is often behind; a stale local would rebase/push without them.
git fetch -q origin "$BRANCH" || true
if git rev-parse -q --verify "origin/$BRANCH" >/dev/null &&
  [[ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH")" ]] &&
  git merge-base --is-ancestor HEAD "origin/$BRANCH"; then
  echo "==> $BRANCH is behind origin; fast-forwarding"
  git merge -q --ff-only "origin/$BRANCH"
fi

# Why: release tags sit on release branches, not on upstream/main, so `git describe` can't find a main-based base.
# The fork commits are everything not reachable from upstream branches or tags; the base is the parent of the oldest.
first=$(git rev-list --reverse HEAD --not --remotes=upstream --tags | sed -n 1p)
if [[ -n "$first" ]]; then old=$(git rev-parse "$first^"); else old=$(git rev-parse HEAD); fi
latest=$(git tag -l 'v[0-9]*' --sort=-v:refname | grep -v -- - | head -1)

case "${1:-}" in
  main | upstream/main)
    new=upstream/main
    echo "==> track: upstream/main (unreleased); 'orca-rebuild $latest' returns to releases"
    ;;
  "")
    # Why: a release tag is never an ancestor of main (release commits), so this only holds when tracking main.
    if git merge-base --is-ancestor "$old" upstream/main; then
      new=upstream/main
      echo "==> track: upstream/main (unreleased); 'orca-rebuild $latest' returns to releases"
    else
      new=$latest
      echo "==> track: releases ($new); 'orca-rebuild main' switches to upstream/main"
    fi
    ;;
  *) new=$1 ;;
esac
old_sha=$old
new_sha=$(git rev-parse "$new^{commit}")

# A build of anything but an exact stable tag gets a synthetic, higher-than-latest version.
version=
if [[ -z "$(git tag -l 'v[0-9]*' --points-at "$new_sha" | grep -v -- - || true)" ]]; then
  IFS=. read -r major minor patch <<<"${latest#v}"
  version="$major.$minor.$((patch + 1))-main.$(date +%Y%m%d).g${new_sha:0:7}"
fi
# Why: the builder config already maps this onto extraMetadata.version (what app.getVersion() reads) without dirtying the tree.
if [[ -n "$version" ]]; then export ORCA_LOCAL_BUILD_VERSION="$version"; fi

if [[ "$old_sha" != "$new_sha" ]]; then
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
  # Why: after resolving a rebase conflict by hand, the rerun lands here; publish the resolved branch.
  if [[ "$(git rev-parse HEAD)" != "$(git rev-parse "origin/$BRANCH" 2>/dev/null)" ]]; then
    git range-diff "origin/$BRANCH...HEAD" || true
    git push -q --force-with-lease origin "$BRANCH"
  fi
fi

echo "==> installing dependencies"
pnpm install --frozen-lockfile
(cd mobile && pnpm install --frozen-lockfile)

echo "==> typechecking"
pnpm tc

# Tests of every file the fork commits touch: touched tests themselves, plus
# the sibling foo.test.ts(x) / foo.*.test.ts(x) of each touched source file.
echo "==> testing fork patches"
# Plain bash 3.2 (macOS /bin/bash): no mapfile, no associative arrays.
tests=()
while IFS= read -r t; do
  tests+=("$t")
done < <(
  git diff --name-only "$new"..HEAD -- 'src/*.ts' 'src/*.tsx' | while IFS= read -r f; do
    [[ -f "$f" ]] || continue
    if [[ "$f" =~ \.test\.tsx?$ ]]; then
      echo "$f"
      continue
    fi
    base="${f%.*}"
    for t in "$base".test.ts "$base".test.tsx "$base".*.test.ts "$base".*.test.tsx; do
      [[ -f "$t" ]] && echo "$t"
    done
  done | sort -u
)
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
    sudo apt install -y --reinstall --allow-downgrades "./$deb"
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

if [[ -n "$version" ]]; then
  echo "==> done: Orca $version + $(git rev-list --count "$new..HEAD") fork patches"
else
  echo "==> done: Orca $(git describe --tags --abbrev=0 --match 'v[0-9]*' --exclude '*-*' HEAD) + $(git rev-list --count "$new..HEAD") fork patches"
fi
