// Infrastructure packages have their own runtime and test configuration.
// The publishing preflight suite uses node:test and is already run by node --test
// before Vitest in the npm test script. Avoid collecting it a second time.
export default {
  test: {
    include: ["tests/**/*.test.{ts,js,mjs}"],
    exclude: ["tests/*preflight.test.mjs"],
  },
};
