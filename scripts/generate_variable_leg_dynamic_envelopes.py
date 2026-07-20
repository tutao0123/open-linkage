"""Generate phase-dependent safe envelopes for telescopic walking-leg bars."""

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
SCANNER = ROOT / "scripts" / "scan-variable-leg-dynamic-envelope.ts"
DEFAULT_OUTPUT = ROOT / "src" / "data" / "variable-leg-dynamic-envelopes.json"


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


def scan_one(task: dict[str, Any], phases: int, lengths: int, iterations: int) -> dict[str, Any]:
    return run_scanner([
        "--topology", task["topology"],
        "--bar", task["barId"],
        "--phases", str(phases),
        "--lengths", str(lengths),
        "--iterations", str(iterations),
    ])


def main() -> None:
    parser = argparse.ArgumentParser(description="Generate dynamic walking-leg length envelopes")
    parser.add_argument("--jobs", type=int, default=min(6, max(1, (os.cpu_count() or 2) - 1)))
    parser.add_argument("--phases", type=int, default=72)
    parser.add_argument("--lengths", type=int, default=61)
    parser.add_argument("--iterations", type=int, default=70)
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()

    tasks = run_scanner(["--list"])
    results: list[dict[str, Any]] = []
    print(f"Scanning {len(tasks)} dynamic bar envelopes with {args.jobs} workers...")
    with ThreadPoolExecutor(max_workers=args.jobs) as executor:
        futures = {
            executor.submit(scan_one, task, args.phases, args.lengths, args.iterations): task
            for task in tasks
        }
        for index, future in enumerate(as_completed(futures), start=1):
            task = futures[future]
            result = future.result()
            results.append(result)
            transition = result["common"]["transition"]
            print(
                f"[{index:02d}/{len(tasks):02d}] {task['topology']}/{task['barId']}: "
                f"coverage={transition['phaseCoverage']:.1%}, "
                f"transition-overlap={transition['overlappingTransitionRatio']:.1%}"
            )

    payload: dict[str, Any] = {
        "version": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "solver": {
            "phaseSamples": args.phases,
            "lengthSamples": args.lengths,
            "iterations": args.iterations,
            "acceptance": "branch-continuous-and-not-singular",
            "units": {"phase": "cycle", "length": "baseline-ratio", "speed": "mm/s", "acceleration": "mm/s^2"},
        },
        "topologies": {},
    }
    for result in sorted(results, key=lambda item: (item["topology"], item["barId"])):
        topology = payload["topologies"].setdefault(result["topology"], {"bars": {}})
        topology["bars"][result["barId"]] = {key: value for key, value in result.items() if key != "topology"}

    output = args.output.resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(payload, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf-8")
    print(f"Wrote {output}")


if __name__ == "__main__":
    main()
