# GitHub Actions VPS Deploy Plan

## Summary

Automate production deployment on every push to `main` using GitHub Actions over SSH to a DigitalOcean VPS, with secure secret handling, serialized deploys, migration execution, external health validation, and rollback behavior. The initial approach keeps the current root Docker Compose production pattern and does not introduce a container registry in this phase.

## Goals

- Deploy updated code automatically from `main` to the VPS.
- Keep the deployment deterministic and repeatable.
- Run database migrations after a successful service update.
- Validate the deployment from outside the server with an HTTPS health check.
- Reduce risk with strict SSH host verification, minimal workflow permissions, and deployment serialization.

## Phase 1: Deployment Contract and Security Inputs

1. Define the deployment contract for one VPS target:
   - repository checkout path on the server
   - SSH user
   - VPS host
   - branch (`main`)
   - deploy lock behavior
2. Create the required GitHub repository secrets and variables for secure, non-interactive deployment.
3. Pin the VPS SSH host key fingerprint and enforce strict host key checking in the workflow SSH setup.
4. Confirm server prerequisites and least-privilege runtime:
   - Docker Engine
   - Docker Compose v2
   - non-root deploy user in the `docker` group
   - repository already cloned on the server
   - protected permissions for runtime env files

## Phase 2: Workflow Design in GitHub Actions

1. Add one production workflow triggered by push to `main`.
2. Enable concurrency so only one deploy runs at a time and in-progress runs are canceled.
3. Set minimal workflow permissions, with `contents: read` only.
4. Prevent token persistence in checkout.
5. Add pre-deploy gates in the GitHub Actions runner:
   - backend lint
   - backend build
   - frontend build
   - frontend test
6. Add the SSH deploy sequence on the VPS:
   - navigate to the repository path and fail fast on shell errors
   - fetch and reset to `origin/main` for a deterministic state
   - ensure the production env file exists and is permission-restricted
   - run compose config validation for the root merge
   - pull/build and restart using the root production merge command
   - run migrations from the API container after services are up
7. Add a post-deploy external smoke check from the GitHub runner against the HTTPS health endpoint with retry/backoff.
8. Add failure diagnostics collection that always runs on failure to capture remote `docker compose ps` output and recent logs for API, Caddy, and worker services.

## Phase 3: Operational Safety and Rollback

1. Define a rollback procedure callable from a manual `workflow_dispatch` input:
   - rollback to the previous commit on the VPS and redeploy
   - rollback the last migration batch when required
2. Add a visibility baseline:
   - workflow job summary should include deployed commit SHA
   - target host alias
   - migration result
   - smoke-check status
3. Add branch protection expectations:
   - require deploy workflow status checks
   - optionally split build/test from deploy later if runtime increases

## Phase 4: Documentation and Runbook Alignment

1. Update root deployment docs to include the GitHub Actions auto-deploy flow for DigitalOcean VPS.
2. Document the secrets inventory and server bootstrap checklist.
3. Document emergency actions:
   - disable the workflow
   - rerun a previous SHA
   - run manual migration rollback
4. Explicitly document production-only constraints already present in the repo:
   - never enable dev-only flags in production
   - keep secrets out of git
   - keep TLS domain and env values accurate

## Relevant Files

- [README.md](../README.md) - add a high-level CI/CD deployment section and main branch deploy behavior.
- [.env.example](../.env.example) - ensure production variables used by VPS deploy are documented without exposing secrets.
- [docs/ARCHITECTURE.md](../docs/ARCHITECTURE.md) - align runtime and deploy architecture with GitHub Actions -> SSH -> VPS compose flow.
- [backend/README.md](../backend/README.md) - add migration expectations during deployment and rollback notes.

## Verification

1. Trigger the workflow by pushing a non-breaking commit to `main` and verify only one deployment runs due to concurrency.
2. Confirm the remote host applies the latest `origin/main` commit and compose services converge without errors.
3. Confirm the migration step reports success and migration status is current.
4. Confirm the external HTTPS health endpoint returns success after deployment.
5. Simulate a failing smoke check and verify the workflow surfaces remote diagnostics logs.
6. Run the manual rollback path once in a controlled test and verify service recovery.

## Decisions

- Included scope: auto deploy on push to `main` using SSH and the root production compose merge on the VPS.
- Included scope: automatic migrations on each successful deploy.
- Included scope: external HTTPS health probe as the success gate.
- Excluded for now: container registry-based immutable image deploys.
- Excluded for now: blue/green deployment and zero-downtime orchestration.
- Excluded for now: Terraform-driven infrastructure provisioning changes.

## Further Considerations

1. Start with a single production workflow job now, then split into separate build-test and deploy workflows only if runtime or maintenance overhead grows.
2. Add a second manual rollback workflow after the first stable week of automated deploys to keep the main deploy flow simple.
3. Once stable, move from VPS local image builds to registry-based image promotion for faster and more reproducible releases.
