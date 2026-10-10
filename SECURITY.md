# Security Policy

## Supported versions

Security fixes are applied on the default branch (`main`).

## Reporting a vulnerability

Please **do not** open a public issue for security problems.

Use GitHub’s [private vulnerability reporting](https://github.com/janpetr93/OpenTrainer/security/advisories/new) for this repository. Include:

- A short description of the issue
- Steps to reproduce (or a proof of concept if safe)
- Impact (what an attacker could do)

You’ll get a response when the report is reviewed. Please give reasonable time for a fix before any public disclosure.

## Scope notes

OpenTrainer runs locally. Keep secrets out of git:

- Put Strava credentials in `companion/.env` (see `companion/.env.example`)
- Never commit `.env`, tokens, or Local Store ride data
