---
name: test-intentionally
description: Helps to decide when a test is worth keeping
license: Unlicense
---

# Test intentionally

## Categorizing tests by their value

Tests can be categorized into one of three groups by their usefulness:

### Valuable tests

- those that guard invariants
- those that observe interactions between subsystems
- those that ensure security properties

### Validation tests

- those that prove that a certain one-off change has been implemented

### Garbage tests

- check that something is absent (a file, a css rule, a resource, and endpoint)
- trivial tests (tests that simply mirror implementation code, in spirit of "a = 42; assertEqual(a, 42)")
- check constants or data layout of values that are essentially fixtures (not produced by non-trivial program behaviors)
- checks that do not involve any moving parts in the logic: any kind of input-conditional branching, looping, concurrency, etc; indirection alone does not count.

## Categorization examples

- "two users can't edit the same document" -> valuable test
- "the backend does not error with 429 in /session anymore" -> validation test, acceptable after a fix has been made
- "slice the number of elements in an array and keep first 30" -> asserting that the length of an array is <= 30 would be a garbage test (one off task, trivial logic)

# Test preservation policy

- valuable tests: keep checked in the repo
- validation tests: needed for the agent to sanity-check a change, but should be removed before human review - they should not be checked into the codebase after the value they have provided has landed on the table.
- garbage tests - should not be added in the first place, and if they accidentally are, they should be removed mercilessly
