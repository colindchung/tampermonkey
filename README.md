# Tampermonkey scripts

Install a script by creating a new script in Tampermonkey and pasting the corresponding file.

## GitHub PR triage

`scripts/github_pr_triage.user.js` adds an expandable summary above GitHub repository PR lists and highlights Dependabot rows. It reports author, visible check/conflict metadata, and opened time for the currently loaded results. Open a PR for details that GitHub does not expose in the list. It updates when GitHub replaces page content.

## GitHub PR context copier

`scripts/github_pr_context.user.js` adds **Copy PR context** beside the PR heading. It copies Markdown containing the title, canonical URL, rendered description text, and visible check/merge summary. Use the Conversation tab with checks expanded for the fullest context. Missing content is explicitly labeled; the script never fetches credentials or calls external services. If clipboard access fails, it displays selectable text.
