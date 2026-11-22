---
name: test-intentionally
description: Helps to decide when a test is worth keeping
license: Unlicense
---

## Test categories

Tests can be categorized into one of three groups by their usefulness: valuable tests, validation tests and garbage tests.

Valuable tests:
- those that guard invariants
- those that observe interactions between subsystems
- those that ensure security properties

Validation tests:
- those that prove that a certain one-off change has been implemented

Garbage tests:
- check that something is absent (a file, a css rule, a resource, and endpoint)
- check that some behavior is no longer present, in the case where the old behavior can't realistically happen because the logic that led to it is no longer implemented in the code
- check constants or data layout of values that are essentially fixtures (not produced by non-trivial program behaviors)

Examples:

- "make sure two users can't edit the same document" -> valuable test
- "make sure the backend does not error with 429 in /session anymore" -> validation test, acceptable after a fix has been made
- "slice the number of elements in an array and keep first 30" -> asserting that the length of an array is <= 30 would be a garbage test (one off task, trivial logic)


# Which tests to keep?

- permanent tests: keep checked in the repo
- temporary tests: needed for the agent to sanity-check a change, but should be removed in a single commit before creating a PR - they should not be checked into the codebase after the value they have provided is on the table
- unnecessary tests - should not be added in the first place, and if they accidentally are, they should be removed mercilessly
