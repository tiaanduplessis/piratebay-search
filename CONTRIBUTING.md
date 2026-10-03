# Development

Use Node.js 22 or 24 and Yarn Classic 1.22.22 for development. These are
contributor-tooling requirements only; this change does not add a consumer
Node.js engine requirement or alter the CommonJS entry point.

```sh
yarn install --frozen-lockfile --ignore-scripts --ignore-optional
yarn lint
yarn test
yarn test:coverage
```

The default lint command reports issues without rewriting files. ESLint uses
the Standard 17.1.2 configuration with its compatible ESLint 8.57.1 release.
ESLint 8 is end-of-life; this deliberately limited migration is not a claim
that every development tool is actively maintained. The only rule overrides
preserve existing brace spacing and property quoting in `src/index.js`.

Tests use Node's built-in test runner and strict assertions. Both test files
run in isolated processes. The application suite temporarily replaces the
`node-fetch` entry in `require.cache` before loading the unchanged CommonJS
module, then immediately restores the previous cache entry. The application
retains the offline mock, whose implementation and call history reset between
tests. Mocked timers reset after each test. No experimental module-mocking
flag is required; Node 22 may report an experimental warning for mock timers.

All responses are synthetic fixtures. Do not run `example.js`, contact live
search/proxy services, or download content to validate changes. The dependency
security tests probe the Lodash instance resolved from Cheerio using private
constructors; they do not establish an exploit through the public search API.

The coverage command uses Node's experimental V8 coverage reporting and only
includes `src/index.js`. Its branch counts are not directly comparable with
the previous Jest/Istanbul instrumentation.
