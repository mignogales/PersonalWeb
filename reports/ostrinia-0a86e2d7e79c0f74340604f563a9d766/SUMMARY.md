# Completed covariates-only annual-shape HPO

Predict the relative 0–1 annual Ostrinia curve from weather, degree-days, calendar and static covariates. Ostrinia history and its observation mask are constant zero in all training, validation and forecast inputs. The 27 other features and graph are retained. Annual node-year maxima define supervised labels and evaluation only; forecast inputs need no insect observations or annual maximum. Batch 32, the 15-day lead and October exclusion are unchanged.

Best 2022 MAE: **GRU-GCN · Synthetic pretraining → zero-shot real · 0.07221 ± 0.00832**.

150 fresh HPO configurations, 100 finalist-validation bundles and 150 audited 2022 forecasts are complete.

- [Full report](index.html)
- [Metrics, evidence and all observed/forecast plots](final_test_2022/SUMMARY.md)
- [Completed HPO and validation curves](HPO_PROGRESS_REPORT.html)
- [All HPO scores and screening plots](screening_hpo/SUMMARY.md)

Earlier forecasting results are superseded for the current analysis and preserved as archived evidence. Annual maxima define labels only. The previously inspected 2022 season is exploratory annual-shape evidence.
