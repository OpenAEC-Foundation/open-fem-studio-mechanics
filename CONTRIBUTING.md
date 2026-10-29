# Contributing to Open FEM Studio Mechanics

Thank you for helping! Bug reports, verification examples, translations and code are all welcome.

## Reporting a problem

Use the issue templates. For a wrong result, attach the model (`.ifcfem`) and state the expected value and its
source (hand calculation, textbook, benchmark). Wrong numbers are the most important bugs we can fix.

## Making a change

1. Fork the repository and create a branch from `main`.
2. Set up the development environment as described in the [README](README.md#building-from-source).
3. Keep changes focused; one topic per pull request.
4. Solver changes need a test: the tests in `design-mockup/test-*.mjs` are set up analytically (closed-form
   solutions or published benchmarks). Register a new test in `design-mockup/scripts/run-tests.mjs`. Never update
   a reference value without explaining where the new number comes from.
5. After a change to the solver core (`design-mockup/src/core/`) or `engine.ts`, rebuild the MCP solver bundle
   with `npm run build:sidecar` in `design-mockup/` and commit the bundle and its `.sha256`.
6. Before you open the pull request:
   ```bash
   cd design-mockup && npx tsc --noEmit && node scripts/run-tests.mjs
   cd ../src-tauri && cargo test --workspace --exclude open-fem-studio
   ```
7. New user-interface text needs translations in all four languages (`design-mockup/src/i18n/locales/{en,nl,de,fr}`).

## License

By contributing you agree that your contribution is licensed under the license of the part you change
(see [README → License](README.md#license)).
