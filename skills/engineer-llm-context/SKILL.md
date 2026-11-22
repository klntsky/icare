---
name: engineer-llm-context
description: Write and review LLM prompts and workflows to avoid common prompting pitfalls. Use when creating or changing prompts, tool instructions, or workflow context.
license: Unlicense
---

# Engineer LLM context

LLMs are surpisingly bad at prompting, therefore any task that involves writing a prompt requires increased amount of thinking.

This skill provides an algorithm and a set of rules that helps a LLM agent to avoid common prompting pitfalls.

# Common LLM prompting pitfalls

## Prompts restating tool descriptions

### How to fix
If the prompt specifies when the tools should be called, that part should not contain tool descriptions - tool names are enough.
Otherwise, the tools should not be referenced in the main prompt at all: no need to mention them for the sake of mentioning.

## Unnecessary elaboration

### Example

BAD:
"Contribute reflective observations and questions about meaning, reasoning, flow, and expressive choices in this text"

BETTER:
"Contribute reflective observations and questions about the content of this text"

### How to detect

Watch for the use of comma-separated sequences of words/phrases. Whether the elaboration is justified depends on the intent behind the code - comma separated lists are not a problem in all cases.
Signs of unnecessary elaboration:
- the items in the list don't have special meaning or handling in the domain code
- the items in the list are not referenced anywhere in the prompt
- the items in the list have close meaning
- removing some items in the list would not make a difference

The most important criterion is whether the elaboration is justified by intent. If intent is unclear, ask the user.

### How to fix

This problem boils down to "opt-in thinking": the LLM assumes that it needs to include as much as possible to ensure that every possible case is covered.
In reality, such prompts are not efficient.
Replace repeating phrases with a more concrete referent.

## Outside-context leaks into the prompt

LLM inference has a very limited view of the world: only the prompt contents, tool definitions, and tool outputs are visible to the model.
LLMs consistently fail with presenting just the right amount of context via these mediums because they have limited ability to hypothesize about inference processes that have different context than their own.

### How to detect

Specific things to watch for - when passed to the LLM context, these are almost always unneeded:

- UI settings
- version numbers
- domain-specific terms that the LLM can't make sense of in the context of its inference workflow

Universal algorithm for detection: go backwards from expected LLM workflow outputs to the inputs:
- what are the logical requirements that need to be in the context of a LLM at the final step in order to produce a result?
- what are their requirements?
- repeat this question until you get a clear picture of what is really needed for a workflow to run.
- what did we not use? these are good candidates for removal

### How to fix

For every piece of context, such as:
- a prompt sentence
- a rule
- a tool definition
- expected tool output,
construct a justification for why it should be present (what removing it would break).

No justification -> remove

## Agentic workflows include too much optional context

The purpose of agentic workflows is to orient and execute in a not-very-structured environment.

### How to detect

Trait to watch for: agentic workflow executions do not utilize their context fully most of the time.

### How to fix

Unless other considerations override that, optional context may be hidden behind tool calls that can be used to discover it. 
Additional complexity and worse speed are valid objections to this.

Fix only after user approval.

## Unnecessary reference indirection breaks context locality

LLMs can't resolve references reliably.
Information scattered across a long context, connected through opaque IDs, is an anti-pattern.

### How to detect

- Synthetic IDs are used, and different parts of the prompt reference them.
- Information that must be considered together is separated by large amounts of unrelated content
- A task requires reconstructing relationships that could have been represented explicitly

### How to fix

- Can opaque IDs be eliminated without duplicating data in the context?
  - Yes -> eliminate
  - No -> use **understand-intent** to decide

## Unnecessary token spending on opaque identifiers

Opaque identifiers are rarely a good idea, but if they are justified by user's intent, they must be used properly, without wasting too many tokens.

### How to detect

- The use of long synthetic ID formats, such as hex strings, base64, hashes,  UUIDs, in the LLM workflow context

### How to fix

Replace long opaque IDs with short enumeration-style IDs, <some-short-fixed-prefix><sequential number>.

Maintain a mapping from short IDs to long IDs and back. Persist it as long as the context is kept for future use. 
Transform between two formats whenever data enters or leaves the LLM context.
If possible, use type system guarantees to prevent accidential confusion between two formats.
Before applying this fix, use **understand-intent** skill to decide whether the additional complexity is justified by the token savings.

## Operational LLM workflows contain too much decision branching

LLMs can perform dispatch, but they are slow.

### How to fix

A fanout dispatcher in front of many branches with leaner context and more straightforward logic is almost always a better solution.
Consider using a decision model for the dispatcher. Use **understand-intent** skill before deciding.


# Glossary

There are two types of LLM workflows (roughly):
- agentic: the LLM is expected to orient situationally in order to achieve a free form goal
- operaitonal: the goal is constrained enough for it to be possible to achieve it following an algorithm
