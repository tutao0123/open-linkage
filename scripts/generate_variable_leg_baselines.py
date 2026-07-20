"""Generate normalized feasibility baselines with the production TypeScript solver.

Python coordinates independent CPU workers; each worker invokes the repository's
actual variable-leg solver through vite-node so offline and browser validation use
the same geometry rules.
"""

from __future__ import annotations

import argparse
import json
import os
import subprocess
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


ROOT = Path(__file__).resolve().parents[1]
SCANNER = ROOT / "scripts" / "scan-variable-leg-baseline.ts"
DEFAULT_OUTPUT = ROOT / "src" / "data" / "variable-leg-baselines.json"


def run_scanner(arguments: list[str]) -> Any:
    executable = ROOT / "node_modules" / ".bin" / ("vite-node.cmd" if os.name == "nt" else "vite-node")
    completed = subprocess.run(
        [str(executable), str(SCANNER), *arguments],
        cwd=ROOT,
        check=True,
        capture_output=True,
        text=True,
        encoding="utf-8",
    )
    return json.loads(completed.stdout)


def scan_one(task: dict[str, Any], samples: int, phases: int, iterations: int) -> dict[str, Any]:
    return run_scanner([
        "--topology", task["topology"],
        "--task", task["key"],
        "--samples", str(samples),
        "--phases", str(phases),
        "--iterations", str(iterations),
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate variable-leg feasibility baselines")
    parser.add_argument("--jobs", type=int, default=min(6, max(1, (os.cpu_count() or 2) - 1)))
    parser.add_argument("--samples", type=int, default=81)
    parser.add_argument("--phases", type=int, default=36)
    parser.add_argument("--iterations", type=int, default=70)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    tasks = run_scanner(["--list"])
    results: list[dict[str, Any]] = []
    print(f"Scanning {len(tasks)} parameter baselines with {args.jobs} workers...")
    with ThreadPoolExecutor(max_workers=args.jobs) as executor:
        futures = {
            executor.submit(scan_one, task, args.samples, args.phases, args.iterations): task
            for task in tasks
        }
        for index, future in enumerate(as_completed(futures), start=1):
            task = futures[future]
            result = future.result()
            results.append(result)
            print(
                f"[{index:02d}/{len(tasks):02d}] {task['topology']}/{task['key']}: "
                f"{result['feasibleSamples']}/{result['valueSamples']} feasible, "
                f"{len(result['intervals'])} interval(s)"
            )

    payload: dict[str, Any] = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "solver": {
            "valueSamples": args.samples,
            "phaseSamples": args.phases,
            "iterations": args.iterations,
            "purpose": "broad-structural-envelope",
            "acceptance": "not-worse-than-template",
        },
        "topologies": {},
    }
    for result in sorted(results, key=lambda item: (item["topology"], item["key"])):
        topology = payload["topologies"].setdefault(result["topology"], {
            "referenceLength": result["referenceLength"],
            "parameters": {},
        })
        topology["parameters"][result["key"]] = {
            "kind": result["kind"],
            "targetId": result["targetId"],
            "axis": result.get("axis"),
            "baseline": result["baseline"],
            "intervals": result["intervals"],
            "feasibleSamples": result["feasibleSamples"],
            "totalSamples": result["valueSamples"],
            "baselineQuality": result["baselineQuality"],
        }

    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
