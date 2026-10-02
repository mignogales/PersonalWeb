# PersonalWeb project memory

## Current objective
Keep the newly published, unlinked Ostrinia covariates-only report at its existing website URL; superseded forecasting results have been replaced.

## Constraints and decisions
- Report URL: https://miguelnogales.com/reports/ostrinia-0a86e2d7e79c0f74340604f563a9d766/ . It redirects to the same path on personal.miguelnogales.com.
- This report is served by the existing Cloudflare Worker, `mainpersonalweb`. Raspberry hosts application APIs; its public health endpoint remains healthy. Its local/remote SSH names were unavailable during this task.
- Keep the report unlinked from site navigation and retain noindex/nofollow/noarchive on its HTML pages. Preserve original experiment artifacts in the Ostrinia project.
- Exclude project memory and detailed records from public static assets.

## Verified status (2026-10-02)
- Worker version `04643a60-2ece-46c2-86da-d194c440efb9` deployed successfully.
- New report contains 15 embedded forecast plots, current HPO/evaluation evidence and 485 published files; every file returned HTTP 200. Report and representative forecast hashes match the package. Four obsolete report-only assets return 404.
- Source folder: `reports/ostrinia-0a86e2d7e79c0f74340604f563a9d766/`.

## Evidence and next step
- Owning experiment: `/Users/miguelnogales/Desktop/PhD/Projects/ostrinia/paper_results/graph_architecture_no_target_history_hpo30_seed10_20261002/`.
- Publication audit/package manifest: Ostrinia `output/publish/PUBLICATION_VERIFICATION.json` and `PUBLIC_REPORT_PACKAGE_MANIFEST.json`.
- Detail: `memory/records/20261002T151349-replace-unlisted-ostrinia-report-with-fresh-covariates-only--1b093af4.md`. Keep this report folder current on future deployments; no publication remains pending.
