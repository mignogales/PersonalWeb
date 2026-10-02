---
title: Replace unlisted Ostrinia report with fresh covariates-only HPO results
status: current
kind: deployment
recorded_at: '2026-10-02T15:13:49.473603+00:00'
sources:
- reports/ostrinia-0a86e2d7e79c0f74340604f563a9d766/index.html
- reports/ostrinia-0a86e2d7e79c0f74340604f563a9d766/REPORT_REFRESH_STATUS.json
- .assetsignore
- project_memory.md
experiment_id: null
supersedes: []
---

On 2026-10-02 the user requested replacing the previously published Ostrinia report with the new covariates-only study and returning only the link. The existing publication was discovered in the recent “Add graph transfer comparisons” chat and verified against this repository and public HTTP responses. It is a static asset route on the existing Cloudflare Worker, not a Raspberry-hosted report. That hosting distinction was stated to the user before proceeding.

Public URL: https://miguelnogales.com/reports/ostrinia-0a86e2d7e79c0f74340604f563a9d766/ . Canonical redirect: https://personal.miguelnogales.com/reports/ostrinia-0a86e2d7e79c0f74340604f563a9d766/ . No site navigation links were added. Every report HTML page has noindex,nofollow,noarchive.

The old report folder was backed up to `/Users/miguelnogales/Desktop/PhD/Projects/ostrinia/paper_results/report_archive_20261002/public_previous_report/` and replaced with a package built from the completed fresh HPO run. The package includes 15 embedded final forecast plots, 15 downloadable final plots, all 450 screening plots, completed HPO HTML, metric CSVs, frozen-selection JSON and input/final/report audits: 485 files, 77,324,618 bytes. File/selection labels and metrics are current-run-only. Supporting Markdown and self-links were rebased to the published index; CSV copies use LF. No experimental metrics or frozen source selections were modified.

Deployment: bundled PNPM `dlx wrangler@4 deploy`, Wrangler 4.145.0, exit 0. Worker `mainpersonalweb` version `04643a60-2ece-46c2-86da-d194c440efb9`. On 2026-10-02 15:10:20 UTC, anonymous HTTP GET reproduced the report SHA256 exactly (`d334563a530c50766de21a86bb26f02887f174351f1f0cf55b57674a65733a8c`); all 485 published files returned 200; report tables contain five rows per regime; 15 embedded images and robots meta passed. A reused GRU-GCN zero-shot forecast PNG URL matched the fresh-run package hash. Superseded milestone heatmap SVG and old milestone BY_NODE/BY_SEED/COMBINED CSV URLs return 404.

Owning experiment: `/Users/miguelnogales/Desktop/PhD/Projects/ostrinia/paper_results/graph_architecture_no_target_history_hpo30_seed10_20261002/`. Publication source/manifests/audit: Ostrinia `output/publish/ostrinia-0a86e2d7e79c0f74340604f563a9d766/`, `output/publish/PUBLIC_REPORT_PACKAGE_MANIFEST.json`, `output/publish/PUBLICATION_VERIFICATION.json`.

The current PersonalWeb main initially matched remote main at `38c4fbd5d66144aeca611e4ac508ec689668ff75`. Git scope: this report replacement and its operational memory only. `.assetsignore` now excludes `project_memory.md` and `memory/**` so operational records never become public assets. The verified project root was registered as `personalweb` in the memory registry.

Raspberry API `https://api.miguelnogales.com/health` was healthy. SSH via `raspberry.local` failed DNS; prepared `ssh.miguelnogales.com` also lacked DNS. The historical saved Raspberry IP `192.168.88.16` (matching saved host key) refused port 22. No SSH settings, tunnel routes, account grants or credentials were changed; the existing Worker publication flow fulfilled the prior-report replacement request. No report deployment is pending.
