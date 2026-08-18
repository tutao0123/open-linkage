# OpenLinkage

**Design, simulate, and synthesize planar linkages—directly in your browser.**

[Live app](https://linkage.wtt.autos/en) · [简体中文](README.zh-CN.md) · [Report an issue](https://github.com/tutao0123/open-linkage/issues)

OpenLinkage is an open-source workbench for planar mechanism design. It combines interactive kinematic simulation, trajectory analysis, and goal-driven synthesis in one browser-based interface—from four-bar linkages to walking legs and free-form mechanisms.

No installation is required for the online version, and the design calculations run locally in your browser.

## Workbenches

| Workbench | What you can do | Open |
| --- | --- | --- |
| Four-bar Design | Analyze crank-rocker, double-crank, and double-rocker mechanisms; draw a target path and fit link dimensions. | [Launch](https://linkage.wtt.autos/en/lab) |
| Six-bar Leg Synthesis | Draw a foot trajectory and compare Watt-type six-bar candidates by accuracy and transmission quality. | [Launch](https://linkage.wtt.autos/en/leg) |
| Variable-geometry Walking Leg | Adapt Klann and Jansen legs to cruise, fast, and obstacle-crossing conditions using movable pivots or lockable telescopic links. | [Launch](https://linkage.wtt.autos/en/variable-leg) |
| Straight-line Mechanisms | Compare Watt, Chebyshev, Hoekens, and Peaucellier–Lipkin mechanisms by stroke and straightness. | [Launch](https://linkage.wtt.autos/en/straight-line) |
| Free Mechanism Designer | Build a planar mechanism from joints and links, choose its input, and inspect its motion and trajectories. | [Launch](https://linkage.wtt.autos/en/designer) |

## Highlights

- Interactive SVG workbenches with direct manipulation and animated motion
- Browser-side solvers for kinematic analysis and mechanism synthesis
- Target-path drawing, candidate generation, comparison, and engineering metrics
- Precomputed walkable references for a reliable variable-leg starting point
- Project JSON import and export in supported workbenches
- English and Simplified Chinese interfaces

## Run locally

### Requirements

- Node.js 20.9 or newer
- npm

```bash
git clone https://github.com/tutao0123/open-linkage.git
cd open-linkage
npm ci
npm run dev
```

Open [http://localhost:3000/en](http://localhost:3000/en).

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Start the local development server |
| `npm test` | Run the test suite |
| `npm run lint` | Run ESLint |
| `npm run build` | Create a production build |
| `npm run i18n:generate` | Regenerate the translation dictionary |
| `npm run reference-library` | Regenerate variable-leg reference trajectories |

## Project status

OpenLinkage is under active development. It is intended for learning, mechanism exploration, and early-stage design—not as a substitute for tolerance analysis, structural verification, safety review, or physical prototyping.

Ideas, bug reports, and pull requests are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) before contributing. Please report security issues according to [SECURITY.md](SECURITY.md).

## License

OpenLinkage is available under the [MIT License](LICENSE).
