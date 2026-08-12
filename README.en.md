# OpenLinkage

[中文](README.md) | [English](README.en.md)

OpenLinkage is an open-source, browser-based platform for planar mechanism design and automatic synthesis. Analyze classic mechanisms quickly, or build your own planar mechanism from joints and links.

## Features

- Four-bar parameter editing, motion analysis, path drawing, and dimension synthesis
- Six-bar leg path drawing, multi-candidate synthesis, and transmission-performance evaluation
- Multi-condition path synthesis for variable-geometry walking legs inspired by Klann and Jansen legs
- Comparisons of classic straight-line mechanisms, including Watt, Chebyshev, Hoeken, and Peaucellier mechanisms
- A free mechanism designer for arbitrary planar topologies

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

Useful commands:

```bash
npm run lint   # lint the codebase
npm test       # run tests
npm run build  # create a production build
```

## Live demos

- Website: <https://linkage.wtt.autos>
- Four-bar lab: <https://linkage.wtt.autos/lab>
- Six-bar leg lab: <https://linkage.wtt.autos/leg>
- Variable-geometry walking leg: <https://linkage.wtt.autos/variable-leg>
- Free mechanism designer: <https://linkage.wtt.autos/designer>

## Roadmap

- 0.1: Four-bar design and analysis foundation (released)
- 0.2: General planar constrained mechanisms
- 0.3: Hand-drawn closed paths and browser-side four-bar fitting (basic version released)
- 0.4: Watt-style six-bar leg synthesis and transmission-performance evaluation (released)
- 0.5: Klann/Jansen variable-geometry legs, multi-condition path families, and free-designer handoff (released)

## License

This project is open-sourced under the [MIT License](LICENSE).
