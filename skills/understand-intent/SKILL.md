---
name: understand-intent
description: Understand user's intent in the context of a decision to be made.
license: Unlicense
---

# Understand intent

This skill structures human-in-the-loop LLM workflows. It's aimed at understanding what the user wants and ensuring the user understands what tradeoffs have been considered.

# How to

If you are an AI agent and another skill referred you here, that means we need to make an informed decision between multiple options justified by the developer's intent. Your actions must be visible to the user as you go.

Follow this algorithm:

1. Understand the decision that has to be made: enumerate (write down) the choice options, and categorize choice options by source:

- **developer**: User's (developer's) prompts
- **spec**: Captured intent (specification, docs, etc)
- **skill**: Skill suggestions (fixes or improvements)
- **research**: Choice options collected by gathering data from the real world, e.g. websites
- **code**: Choice options substantiated by code (e.g. existing implementations)

If the choice options include skill suggestions, tell the user:

```
For <choice in question>, evaluating these options:

- **<option content>** (from: *<source here>*): <option description>
- <repeat same format for every option>
```

Investigate the tradeoffs between the choice options, gather the data needed to make an informed decision. 

Data not accessible? -> Ask the user to provide you access using this format:

```
While weighing the <choice in question>, I encountered a problem I can't resolve alone: <describe it here>
```

No additional data needed? -> That's OK, don't overcomplicate

2. Check if we can derive the right decision from the explicitly stated intent.
Look for speech patterns that tell you to prioritize certain values (e.g. "We don't care about test performance" or "Correctness must not be sacrificed")

If the stated priorities clearly indicate what choice option should be prioritized, notify the user of the choice made:

```
For <choice in question>, decided to go with **<option content>** (from: *<source here>*).
Justification: <fill in here>
```

Proceed with that choice and return back to the context that referred you to this skill.

3. If the stated priorities do not clearly suggest a choice, present the user with the choice, including only the relevant evidence and arguments you gathered at step 1. DO NOT follow the same format as above.

4. If you get a straight answer for the choice option, but the user's justification is not obvious, ask the user to clarify intent.

<!-- TODO: add a mechanism for clarifying intent only after we confirm it's not obvious --> 

5. Preserve that intent info using **capture-intent** skill.
