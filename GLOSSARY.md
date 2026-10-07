# Orca (ninh fork)

Vocabulary for features added in this fork on top of upstream Orca. Upstream terms are used as Orca's UI uses them.

## Language

**Workspace**:
One unit of work in the sidebar: a git worktree or a folder workspace, with its terminals, tabs and agent sessions.
_Avoid_: Session (a session lives inside a workspace), card (that is only its rendering)

**Tag**:
A short user-chosen name attached to a workspace; a workspace carries any number of tags, and the same tag spans workspaces from any repo.
_Avoid_: Label, group, category

**Tag color**:
The color a tag shows everywhere it appears, picked at random when the tag is first created and changeable afterwards; it stays with the tag's name even while no workspace carries it.
_Avoid_: Label color, badge color

**Tag filter**:
The set of tags the sidebar is currently narrowed to; while it is set, only workspaces carrying at least one of those tags are shown; pinned workspaces are not exempt.
_Avoid_: Focus mode, view

**Workspace status**:
The single progress stage of a workspace (todo, in progress, in review, completed); orthogonal to tags.
_Avoid_: Tag, state
