# Contributing Workflow

## Mandatory Git Flow

To keep review quality high and preserve auditability, this project uses **PR-only** integration into `main`.

Rules:

- Never push feature/fix work directly to `main`.
- Always work in a branch (`feature/*`, `fix/*`, `release/*`, etc.).
- Open a Pull Request to `main`.
- Repository owner performs merge manually after review.
- Owner may leave a final merge comment in PR before/at merge.

## Agent Git Safety Rule

Automation and coding agents must follow an explicit publish gate:

- Nothing is pushed to GitHub without a direct user command for that specific push.
- Every GitHub-bound change must go through a Pull Request; direct pushes to `main` are forbidden.
- After opening the Pull Request, the agent must give the owner the PR link for confirmation/review.
- The repository owner decides when to merge; agents must not merge PRs unless explicitly instructed.

## Standard Steps

1. Create/update your working branch.
2. Commit and push branch.
3. Open PR to `main`.
4. Wait for GitHub Actions checks.
5. Wait for owner review and manual merge.

## CI/CD Gate

- PRs run full verification against a temporary PostgreSQL database.
- Merges to `main` run the same verification and then apply production Prisma migrations.
- Railway deploys `nearloy-api` and `nearloy-web` from `main` after checks are green.

## Local Safety Guard

This repository includes a local `pre-push` hook (`.githooks/pre-push`) that blocks direct pushes to `main`.

If hooks are not enabled yet, run:

```bash
git config core.hooksPath .githooks
```

After that, attempts to push directly into `main` will be rejected locally.
