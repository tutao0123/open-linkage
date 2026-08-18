# Contributing to OpenLinkage

Thanks for helping improve OpenLinkage. Bug reports, focused feature proposals, documentation improvements, tests, and code contributions are all welcome.

## Before you start

- Search the existing [issues](https://github.com/tutao0123/open-linkage/issues) before opening a new one.
- For a substantial feature or solver change, open an issue first so the approach and scope can be discussed.
- Keep pull requests focused. Separate unrelated cleanup from the change you want reviewed.

## Development setup

OpenLinkage requires Node.js 20.9 or newer.

```bash
git clone https://github.com/tutao0123/open-linkage.git
cd open-linkage
npm ci
npm run dev
```

Before submitting a pull request, run:

```bash
npm test
npm run lint
npm run build
```

## Project conventions

- Add or update tests when changing kinematics, synthesis, geometry, or project-file behavior.
- Keep the English and Simplified Chinese experiences aligned when changing user-facing copy.
- Run `npm run i18n:generate` after changing translatable interface text.
- Regenerate derived trajectory or baseline data through the scripts in `scripts/`; do not edit generated datasets by hand.
- Prefer clear, approachable controls and defaults. Advanced engineering settings should not block a first successful result.
- Do not commit credentials, `.env.local`, build output, or editor-specific files.

## Pull requests

Include:

- what changed and why
- the user-facing impact
- screenshots or a short recording for visual changes
- the checks you ran
- any numerical assumptions, tradeoffs, or known limitations

By contributing, you agree that your contribution will be licensed under the repository's [MIT License](LICENSE).
