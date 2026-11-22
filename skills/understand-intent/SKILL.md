---
name: understand-intent
description: Understand and evaluate user's intent before making a decision. If unclear, collect arguments for and against choice options, and clarify with the user.
license: Unlicense
---

# Understand intent

This skill structures human-in-the-loop LLM workflows. It's aimed at understanding what the user wants.

# How to

If you are an AI agent and another skill referred you here, that means we need to make an informed decision between multiple options justified by the developer's intent.

1. Understand the decision that has to be made: enumerate the choice options.
Investigate the tradeoffs between them. Gather the data needed to make an informed decision. 
Data not accessible? -> Ask the user to expand access.

2. Check if we can derive the right decision from the explicitly stated intent. Look for signals expressing intent in the (in this order):
  - developer's prompt
  - explicit intent documentation
  - product requirements
  - repository context
Look for speech patterns that tell you to prioritize certain values (e.g. "We don't care about test performance" or "Correctness must not be sacrificed")

If the stated priorities clearly indicate what choice option should be prioritized, proceed with that choice and return back to the context that referred you to this skill.

3. Otherwise, present the user with the choice, presenting only the relevant evidence and arguments you gathered at step 1.

4. If you get a straight answer for the choice option, but the user's justification is not obvious, ask the user to clarify intent.

5. Preserve that intent in the repo if there is a place to store it, and return back to the outer context to proceed with the choice.
