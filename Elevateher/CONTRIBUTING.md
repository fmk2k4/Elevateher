# Contributing to ElevateHer

Thank you for your interest in ElevateHer. This platform serves girls as young as 14, including underserved communities. Every contribution must uphold our mission and safety standards.

## Getting started

1. Fork the repo and create your branch from `develop`.
2. Copy `.env.example` to `.env`.
3. Run `docker compose up --build -d`.
4. Make your changes.
5. Run the relevant unit tests.
6. Open a pull request against `develop`.

## Code standards

- Python: ruff, black, type hints on public functions.
- TypeScript: strict mode where applicable, no unjustified `any`.
- Tests: unit test every new function and integration test every new endpoint.
- Coverage: maintain at least 80% line coverage.

## Child safety obligations

Any contribution that touches guardian consent, minor detection, safety classifier thresholds, temporal detector patterns, or message moderation must include a written justification in the pull request description explaining the child safety implications and how the change improves or maintains protection.

Pull requests that reduce safety thresholds without justification will be closed.

## Pull request checklist

- Tests pass locally.
- TypeScript builds without errors where applicable.
- Python linting passes.
- No secrets committed.
- If touching child safety: written safety justification included.

## Branch naming

| Branch type | Pattern | Example |
|---|---|---|
| Feature | `feature/short-description` | `feature/thai-ussd-support` |
| Bug fix | `fix/short-description` | `fix/guardian-consent-email` |
| Safety | `safety/short-description` | `safety/off-platform-pattern` |
| Docs | `docs/short-description` | `docs/api-guide` |

## Security reports

Do not open a public issue for security vulnerabilities. Email security@elevateher.app with the subject `Security Report: [brief description]`.
