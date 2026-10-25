#!/usr/bin/env python3
"""Read-only Rosa snapshot. Install on the login node; never submit a job."""
import concurrent.futures
import csv
import datetime
import io
import json
import math
import re
import subprocess


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def run(args, timeout=12):
    result = subprocess.run(args, stdout=subprocess.PIPE, stderr=subprocess.PIPE, universal_newlines=True, timeout=timeout,
                            env=None, check=True)
    if len(result.stdout) > 4_000_000:
        raise ValueError("Scheduler response too large")
    return result.stdout


def fields(line):
    return dict(re.findall(r"(?:^|\s)(\w+)=(\S*)", line))


def gpu_count(tres):
    match = re.search(r"(?:^|,)gres/gpu=(\d+)(?:,|$)", tres)
    if match:
        return int(match[1])
    typed = re.findall(r"(?:^|,)gres/gpu:[^=,]+=(\d+)", tres)
    return sum(map(int, typed)) if typed else None


def gres_count(value):
    counts = re.findall(r"(?:^|,)gpu:(?:[^:,()]+:)?(\d+)", value)
    return sum(map(int, counts)) if counts else None


def parse_nodes(text):
    nodes = []
    for line in text.splitlines():
        row = fields(line)
        if not row.get("NodeName"):
            continue
        total = gpu_count(row.get("CfgTRES", ""))
        if total is None:
            total = gres_count(row.get("Gres", "")) or 0
        allocated = gres_count(row.get("GresUsed", ""))
        if allocated is None:
            allocated = gpu_count(row.get("AllocTRES", ""))
        # Some Rosa nodes do not register GPUs as TRES. Missing GPU TRES then
        # says nothing about GPU allocation: use detailed GresUsed instead.
        if allocated is None and (total == 0 or (gpu_count(row.get("CfgTRES", "")) is not None and "AllocTRES" in row)):
            allocated = 0
        nodes.append(dict(name=row["NodeName"], state=row.get("State", "UNKNOWN"),
                          partitions=row.get("Partitions", "").split(","),
                          gpuModel=row.get("Gres", ""), gpus=total,
                          allocatedGpus=allocated, cpuAllocated=row.get("CPUAlloc"),
                          cpuTotal=row.get("CPUTot"), telemetry=None))
    if not nodes:
        raise ValueError("No scheduler nodes returned")
    return nodes


def parse_jobs(text):
    keys = ["id", "user", "partition", "state", "elapsed", "limit", "nodes", "cpus", "gres", "reason", "name"]
    jobs = []
    for line in text.splitlines():
        parts = line.split("|", 10)
        if len(parts) != len(keys):
            raise ValueError("Unexpected queue format")
        jobs.append(dict(zip(keys, [part.strip() for part in parts])))
    if len(jobs) > 5000:
        raise ValueError("Queue exceeds snapshot limit")
    return jobs


def telemetry(node):
    if not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9.-]{0,100}", node["name"]):
        return None
    try:
        output = run(["ssh", "-oBatchMode=yes", "-oConnectTimeout=3", "-oStrictHostKeyChecking=yes",
                      node["name"], "nvidia-smi --query-gpu=index,name,utilization.gpu,memory.used,memory.total,temperature.gpu --format=csv,noheader,nounits"], 5)
        rows = []
        for row in csv.reader(io.StringIO(output)):
            if len(row) != 6:
                return None
            values = [float(v.strip()) for v in row[2:]]
            if not all(math.isfinite(v) and v >= 0 for v in values) or values[0] > 100 or values[1] > values[2] or values[3] > 150:
                return None
            rows.append(dict(index=row[0].strip(), name=row[1].strip(), utilization=values[0],
                             memoryUsedMiB=values[1], memoryTotalMiB=values[2], temperature=values[3]))
        return rows or None
    except (OSError, ValueError, subprocess.SubprocessError):
        return None  # Access/driver limitations are unknown telemetry, never zero.


def sample():
    commands = {
        "nodes": ["scontrol", "show", "nodes", "-d", "-o"],
        "jobs": ["squeue", "-h", "-r", "-o", "%i|%u|%P|%T|%M|%l|%D|%C|%b|%R|%j"],
        "partitions": ["sinfo", "-h", "-o", "%P|%a|%l|%D|%t|%G"],
    }
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        pending = {key: pool.submit(run, command) for key, command in commands.items()}
        raw = {key: future.result() for key, future in pending.items()}
    nodes = parse_nodes(raw["nodes"])
    # USI's published cluster policy disallows direct access to compute nodes.
    # Keep this probe strictly on the login node. Slurm does not expose GPU
    # utilization/VRAM here, so leave those measurements unknown.
    partitions = []
    for line in raw["partitions"].splitlines():
        values = line.split("|", 5)
        if len(values) != 6:
            raise ValueError("Unexpected partition format")
        partitions.append(dict(zip(["name", "availability", "limit", "nodes", "state", "gres"], values)))
    return dict(observedAt=now(), nodes=nodes, jobs=parse_jobs(raw["jobs"]), partitions=partitions)


if __name__ == "__main__":
    print(json.dumps(sample(), separators=(",", ":")))
