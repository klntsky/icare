---
name: understand-intent
description: Understand user's intent in the context of a decision to be made.
license: Unlicense
---

## Principles

- Your responses must follow the specified formats exactly. 
- You can only pick a choice autonomously if you can provide a justification that references an existing captured intent. If you can't, you must prompt the user to specify their intent as described below.

## How to

If you are an AI agent and another skill referred you here, that means we need to make an informed decision between multiple options justified by the developer's intent. Your actions must be visible to the user as you go.

Follow this algorithm till the end exactly:

1. Understand the decision that has to be made in the current context: enumerate (write down) the choice options.

2. Categorize choice options by source:

- **developer**: User's (developer's) prompts
- **spec**: Captured intent (specification, docs, etc)
- **skill**: Skill suggestions (fixes or improvements)
- **research**: Choice options collected by gathering data using external lookups, web search, etc
- **code**: Choice options substantiated by code or artifacts (e.g. existing implementations)

If the choice options include skill suggestions, tell the user:

```
For <choice in question>, I'm evaluating these options:

- **<option content>** (from: *<source here>*): <option description>
- <repeat same format for every option>
```

Investigate the tradeoffs between the choice options, gather the data needed to make an informed decision. 

Data not accessible? -> Ask the user to provide you access using this format and stop:

```
While weighing the <choice in question>, I encountered a problem I can't resolve alone: <describe it here>
```

3. Check if you can derive the right decision from the explicitly stated intent belonging to one of the (**developer**, **spec** or **skill** source categories). **research** or **code** are not valid intent sources for a usable justification (they are untrusted).

If the stated priorities clearly indicate what choice option should be prioritized, notify the user of the choice made:

```
For <choice in question>, decided to go with **<option content>** (from: *<source here>*).
Justification: <fill in here>
```

Proceed with that choice and return back to the context that referred you to this skill.

4. If the stated priorities do not clearly suggest a choice, present the user with the choice, including only the relevant evidence and arguments you gathered at step 1. DO NOT follow the same format as above.

5. If you get a straight answer for the choice option, but the user's justification is not obvious, ask the user to clarify intent.

<!-- TODO: add a mechanism for clarifying intent only after we confirm it's not obvious --> 

6. Preserve that intent info using **capture-intent** skill.
