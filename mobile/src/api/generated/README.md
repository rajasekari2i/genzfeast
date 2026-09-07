# Generated API Types — DO NOT HAND-EDIT

Every `*.d.ts` file in this directory is generated from the matching feature's
`specs/<feature>/contracts/openapi.yaml` via `openapi-typescript`. Cross-file
`$ref`s between specs (e.g. `008` referencing `006`'s `Order`/`OrderDetail`
schemas) resolve correctly and are inlined per generated file.

## Regenerating

Run from `mobile/`:

```bash
npm run api:generate
```

This re-runs `openapi-typescript` against every `specs/*/contracts/openapi.yaml`
in the repo root. Run it again whenever a spec's contract changes.
