// Fork build (ninhlv-9984/orca): installed from a locally built package with our own
// patches on top of an upstream tag. The upstream release feed would overwrite those
// patches with the stock build, so in-app updates are off; update by rebuilding.
// Why the VITEST escape: upstream's updater suites keep exercising the real update paths,
// so rebasing onto a new tag still tells us whether that code works.
export const FORK_UPDATES_DISABLED = !process.env.VITEST

export const FORK_UPDATES_DISABLED_MESSAGE =
  'Updates are disabled in this fork build. Run orca-rebuild to update.'
