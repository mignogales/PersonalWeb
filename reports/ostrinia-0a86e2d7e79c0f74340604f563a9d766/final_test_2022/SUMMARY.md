# Covariates-only 2022 test — ten paired seeds

Predict the relative 0–1 annual Ostrinia curve from weather, degree-days, calendar and static covariates. Ostrinia history and its observation mask are constant zero in all training, validation and forecast inputs. The 27 other features and graph are retained. Annual node-year maxima define supervised labels and evaluation only; forecast inputs need no insect observations or annual maximum. Batch 32, the 15-day lead and October exclusion are unchanged.

Fresh HPO: 30 configurations per architecture, screened on 2021 with seed 17 (80 epochs, patience 12). Two common finalists per architecture are rechecked on 2020–2021 with paired seeds 0–9 (120 epochs, patience 18). One shared configuration per architecture is frozen across the three regimes before the 2022 test.

Best mean MAE: **GRU-GCN · Synthetic pretraining → zero-shot real · 0.07221 ± 0.00832**.

All 150 final forecasts are complete. Metrics macro-average three observed nodes, with 549 node-date targets over 183 dates per seed. SD is sample training-seed variability on one year.

Only this fresh covariates-only run is active. Earlier forecasting results are superseded for the current analysis and preserved as archived evidence. Annual maxima define labels only; the outputs describe relative annual shape. The previously inspected 2022 season is exploratory.

## Synthetic pretraining → zero-shot real

| Architecture | MAE ± seed SD | Seeds | Nodes | Targets per seed |
|---|---:|---:|---:|---:|
| GRU-GCN | 0.07221 ± 0.00832 | 10 | 3 | 549 |
| Transformer | 0.11655 ± 0.01382 | 10 | 3 | 549 |
| GRU | 0.12413 ± 0.00857 | 10 | 3 | 549 |
| LSTM | 0.10751 ± 0.00345 | 10 | 3 | 549 |
| Time-spatial Transformer | 0.10003 ± 0.02498 | 10 | 3 | 549 |

## Synthetic pretraining → real fine-tuning

| Architecture | MAE ± seed SD | Seeds | Nodes | Targets per seed |
|---|---:|---:|---:|---:|
| GRU-GCN | 0.07322 ± 0.00478 | 10 | 3 | 549 |
| Transformer | 0.08221 ± 0.00230 | 10 | 3 | 549 |
| GRU | 0.08351 ± 0.00463 | 10 | 3 | 549 |
| LSTM | 0.07923 ± 0.00128 | 10 | 3 | 549 |
| Time-spatial Transformer | 0.08218 ± 0.00627 | 10 | 3 | 549 |

## Real training from scratch

| Architecture | MAE ± seed SD | Seeds | Nodes | Targets per seed |
|---|---:|---:|---:|---:|
| GRU-GCN | 0.09858 ± 0.01521 | 10 | 3 | 549 |
| Transformer | 0.09049 ± 0.00414 | 10 | 3 | 549 |
| GRU | 0.08886 ± 0.00530 | 10 | 3 | 549 |
| LSTM | 0.09230 ± 0.00557 | 10 | 3 | 549 |
| Time-spatial Transformer | 0.08970 ± 0.00604 | 10 | 3 | 549 |

## Observed targets and forecast plots

Each plot shows seed 0 and all three observed nodes.
- [GRU-GCN · Synthetic pretraining → zero-shot real · 2022 · seed 0](plots/real/real_synthetic_zero_shot_real_grugcn_seed_00.png)
- [Transformer · Synthetic pretraining → zero-shot real · 2022 · seed 0](plots/real/real_synthetic_zero_shot_real_transformer_seed_00.png)
- [GRU · Synthetic pretraining → zero-shot real · 2022 · seed 0](plots/real/real_synthetic_zero_shot_real_gru_seed_00.png)
- [LSTM · Synthetic pretraining → zero-shot real · 2022 · seed 0](plots/real/real_synthetic_zero_shot_real_lstm_seed_00.png)
- [Time-spatial Transformer · Synthetic pretraining → zero-shot real · 2022 · seed 0](plots/real/real_synthetic_zero_shot_real_time_spatial_transformer_seed_00.png)
- [GRU-GCN · Synthetic pretraining → real fine-tuning · 2022 · seed 0](plots/real/real_synthetic_finetune_real_grugcn_seed_00.png)
- [Transformer · Synthetic pretraining → real fine-tuning · 2022 · seed 0](plots/real/real_synthetic_finetune_real_transformer_seed_00.png)
- [GRU · Synthetic pretraining → real fine-tuning · 2022 · seed 0](plots/real/real_synthetic_finetune_real_gru_seed_00.png)
- [LSTM · Synthetic pretraining → real fine-tuning · 2022 · seed 0](plots/real/real_synthetic_finetune_real_lstm_seed_00.png)
- [Time-spatial Transformer · Synthetic pretraining → real fine-tuning · 2022 · seed 0](plots/real/real_synthetic_finetune_real_time_spatial_transformer_seed_00.png)
- [GRU-GCN · Real training from scratch · 2022 · seed 0](plots/real/real_real_scratch_grugcn_seed_00.png)
- [Transformer · Real training from scratch · 2022 · seed 0](plots/real/real_real_scratch_transformer_seed_00.png)
- [GRU · Real training from scratch · 2022 · seed 0](plots/real/real_real_scratch_gru_seed_00.png)
- [LSTM · Real training from scratch · 2022 · seed 0](plots/real/real_real_scratch_lstm_seed_00.png)
- [Time-spatial Transformer · Real training from scratch · 2022 · seed 0](plots/real/real_real_scratch_time_spatial_transformer_seed_00.png)

## Evidence

- [Full covariates-only report](../index.html)
- [Completed fresh HPO and validation curves](../HPO_PROGRESS_REPORT.html)
- [All HPO screening metrics and forecast plots](../screening_hpo/SUMMARY.md)
- [Selected common configurations](../MATCHED_SELECTION.csv)
- [Frozen selection hashes](../FROZEN_NO_TARGET_HPO_SELECTION.json)
- [Training / validation / test input-independence audit](NO_TARGET_HISTORY_PREFLIGHT.json)
- [Ten-seed test summary](TEST_RESULTS.csv)
- [All 150 per-seed scores](TEST_RESULTS_BY_SEED.csv)
- [Per-node errors](PER_NODE_TEST_RESULTS.csv)
- [Paired training-regime differences within this run](PAIRED_DELTA_SUMMARY.csv)
- [Crossing errors and coverage](MILESTONE_ERRORS_SUMMARY.csv)
- [Upstream final artifact audit](FINAL_ARTIFACT_AUDIT.json)
- [Independent report and score audit](../REPORT_REFRESH_STATUS.json)
