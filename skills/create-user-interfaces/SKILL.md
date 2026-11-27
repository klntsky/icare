---
name: create-user-interfaces
description: Create or improve user interfaces. Use when designing or implementing user experiences.
license: Unlicense
---

# Create user interfaces

## Theory

LLMs do not understand the concept of negative space.
When they are being trained, if something exists conceptually, there are tokens that correspond to that in their context.
Which means that the absence of a thing is incomprehensible to a LLM.

Human cognition works differently: negative space guides our attention towards the object, and can be used to visually suggest the course of action.

We can overcome this limitation with manual checks and more careful explicit considerations.

## Principles

- The suggested fixes for the problems below are aimed at recovering visual negative space. Do not fill the freed space with anything at all, and do not propose doing that.

## Actions

This skill can be used in two modes:

### Improving an existing interface

Go over the list of pitfalls and nothing else as part of applying this skill.

### Creating an interface from scratch 

- Before starting, do UIF0 p. 2.
- Create the interface
- Go over the list of pitfalls as part of your review or validation process for the task.

## Common user interface pitfalls

### UIF0: UX is not focused on intent

How to detect & fix:

1. Explicitly write down a mapping between UI elements in an interface and user intents that guide the user interacting with these elements.

Example:

```
- button `#click-me`:
  - roll a dice
  - explore the website
  - do an unpredictable action
- button `#close`
  - exit
```

2. Use **understand-intent** skill to get UI intent (choice options are possible interface user intents)
3. For every UI element, write down a reason why removing it would be at odds with fulfilling the core intent.
4. If the reason is not convincing or absent, remove the element

### UIF1: Display-only and interactive elements are not visually separated

Examples:

- labels in the same visual group as buttons, navbars, links
- interactive elements interjecting large blocks of non-interactive content without a visual grouping that guides the user's attention towards interacting with them

How to fix:

- **understand-intent** (choice options: move elements, remove them, regroup, or add visual markers of intent)

### UIF2: Same statements are repeated in a single view with slight variations or elaboration

Example:

```
> Our protocol is the best. Non custodial. Blazing fast.
[ ✅ Non Custodial ] [ ✅ Blazing Fast ]
```

Example:

```
<h1>Copy Trading</h1>
<h2>Copy the best. Trade like them</h2>
<p>Mirror top traders in real time with full transparency.</p>
```

How to fix:

- List the sentences in the UI text as a plain text bullet list, discarding markup.
- For every sentence, specify what information does it add relative to the previous ones.
- If a sentence is an elaboration on the previous one(s), remove the UI elements corresponding to the previous one(s).

### UIF3: Unstructured interactive or stateful UI surfaces

User action choice (menus, navbars, link lists, etc) is a fundamental interaction primitive. Choice options should be presented in a visually uniform way (that's how the user knows they are actionable).

How to detect:

- Actionable elements located "far" from the elements they act on (not grouped together visually)
- Actionable elements of different one-off styles
- Actional elements located on different layout layers (e.g. rows) without a solid intent behind that (**understand-intent**)

### UIF4: Interleaved interactive and display-only elements

Example:

```
Your API key: [sk1-......] [ Copy ] Copying hides the API key [ Revoke ] [ Rotate ]
```

Problem here: "Copying hides the API key" label breaks the UX flow.

How to fix:

Elements that are semantically attached to an action element should be tooltips, confirmation pop-ups, post-action roast notifications, etc

### UIF5: Non-actionable elements using visual language of interactive elements

How to fix:

For non-actionable elements, remove unless justified by intent:

- hover effects
- `pointer` cursor
- cursor override for text elements
- button-like styling
- box shadows, borders or other styling methods for popping them out of the background

A separate case of this problem is screenshots or interface mockups that are placed alongside content to demo the UX.
They can be confused with real interactive elements.
3D-tilt them, slightly rotate, apply shifted box shadow, or draw something on top (use **understand-intent** skill to decide)

### UIF6: call-to-action fatigue

One CTA per logical view is enough.
