# USI Gym

The private website app is `/personal/affluenza`, using the existing owner-only
`personal` grant. The Worker forwards cookies to `/affluenza/summary` on the Pi.
The Pi independently enforces the same grant. No readings are public assets.
The dashboard uses live Pi data. The temporary migration snapshot fallback
was removed once the collector and authenticated API were verified.

The collector saves the public USI visual gauge every ten minutes. This is a
crowding estimate, not an exact occupancy count or calibrated capacity measure.
The CSV remains at `~/Projects/usi-affluenza-monitor/data/affluenza.csv` on the Pi.
`AFFLUENZA_CSV` can override that path for local testing.

Days run from 06:00 Europe/Zurich to the following 06:00. The rolling window
includes the current day plus the previous 29 days. Readings are grouped into
ten-minute UTC intervals; extra manual checks within one interval are averaged.
Daily means average the observed intervals. The mean profile averages each
local time slot across observed days, giving each contributing day equal weight.
Hourly rankings similarly give each observed day equal weight and exclude
00:00–06:00, outside USI's published 06:00–24:00 opening hours. Daily coverage
uses the actual duration, including 23/25-hour daylight-saving days. Missing
readings are excluded, never replaced with zero. Incomplete days are labelled.

## Migration

1. Back up Titan's crontab and remove only its occupancy recorder entry. Keep
   the CSV intact and copy the final snapshot locally.
2. With working Raspberry SSH, run from this repository:

   ```sh
   python3 raspberry-api/deploy_affluenza.py --host raspberry --csv raspberry-api/local-data/affluenza.csv
   ```

   The installer refuses to overwrite a gateway that differs from the known
   baseline, preserves existing CSV rows, saves backups, verifies a real source
   fetch and authenticated API, then enables the ten-minute systemd user timer.
   It does not change SSH credentials, shared accounts, or app grants.
3. Deploy the existing Cloudflare Worker and assets together using wrangler.
4. Verify `/health`, unauthorized `/affluenza/summary` (401), authenticated
   summary (200), and the signed-in website. Check the timer's next trigger.

```sh
systemctl --user status usi-affluenza.timer personalweb-api.service
systemctl --user list-timers usi-affluenza.timer
journalctl --user -u usi-affluenza.service -n 20 --no-pager
```

The timer survives logout and reboot through the Pi's existing user lingering.
Logs go to the system journal. Collection history is retained; only the analysis
window rolls forward. Stop collection with `systemctl --user disable --now
usi-affluenza.timer`. Restart the API after restoring its gateway backup if a
rollback is needed. The original Titan CSV is never deleted.

Validation: `python3 -m unittest discover -s raspberry-api -p test_affluenza.py`
and `node --test tests/affluenza.test.mjs tests/sso.test.mjs`.
