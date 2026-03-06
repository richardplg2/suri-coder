# Code Style

## TypeScript (Biome)

- Single quotes, no semicolons (unless ASI-hazard), trailing commas in ES5 positions
- 2-space indent, LF line endings, 80 char line width
- Arrow parens: as needed
- Biome sorts JSX attributes and object properties alphabetically
- `apps/backend/**` is excluded from Biome — uses Ruff instead
- Auto-format: `pnpm biome check --write .` or `pnpm biome format --write .`

## Python (Ruff)

- Python 3.12 target, 88 char line length
- Rules: E, F, I, N, W, UP (pycodestyle, pyflakes, isort, pep8-naming, warnings, pyupgrade)
- pytest with `asyncio_mode = "auto"`
