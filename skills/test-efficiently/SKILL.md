---
name: test-efficiently
description: Improves performance of the tests
license: Unlicense
---

## Principles for improving test performance

### TP0. Diagnosing test performance problems

Tests share different types of system resources.

When dealing with test performance problems, figure out which resources are the bottleneck first:

- Memory
- CPU utilization (total percentage and pinned cores)
- Disk I/O
- File descriptors
- Environment resources (third-party API ratelimit allowance, remote resource locks, and such)

### TP1. Layered resource management

Resources form layers naturally. 
Example of a multi-layer test environment: funds allocated on a smart contract running on an EVM testnet forked from mainnet that uses a third-party RPC.

Test utilities should contain [bracket-pattern](https://wiki.haskell.org/Bracket_pattern)-style helpers for every layer.

To reduce boilerplate, expose a declarative utility that accepts a single record containing a declaration of every needed resource, and prepares the context for a test runner callback.

Consider that:

- resources can have multiple sources (e.g. a mock EVM chain and a public testnet) - represent that in the interface
- resources may be optional - make them optional in the interface. Ensure the tests only request the needed ones.

### TP2. Optimizing resource sharing

Tests that utilize resources from their environment can be optimized heavily by sharing these resources between tests, as much as isolation requirements permits that.
The decision to do so mush be based on concrete time measurements of resource acquisition and release.

When to use: if the resources are verifiably isolated enough that we don't care about their interactions. Requires understanding both the nature of resources and the way they are used in the application logic.

### TP3. Test parallelization

#### How much to parallelize?

1. Determine if the resources needed for testing are scarce enough for that to be a problem:
  - Measure measureable TP0 resource consumption
  - Third party resources may have documented limits - investigate.
  - Estimate the utilization of the rest of resources using common sense
2. Don't be overprotective: excessive resource utilization can be fixed later. Assume we're good if unclear.
3. The system and other apps compete for some of the resources the tests use. Unless instructed otherwise:
  - if CPU-bound: aim to leave 2 cores unused (roughly, 8 cores implies max 6 runners)
  - if I/O-bound: keep disk I/O utilization roughly below 50%
  - if API ratelimit-bound: parallelization is not helping much, but keep 2 parallel workers so that the tests fail loudly if the app logic silently assumes it can have all the resources to itself without proper ratelimit handling.

#### Sharing resources between parallel test instances

If a test runner or framework supports only file-based test parallelisation, then parallelisation is controled by test file structure.

This approach makes it harder to manage shared resources. In this case, consider implementing a test server that manages the test environment and provides an API for test workers to connect to it. It can be made compatible with TP1 layered resource management, but instead of allocating the resources, the helpers should delegate providing them to the test server.

