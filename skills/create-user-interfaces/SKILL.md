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

The suggested fixes for the problems below are aimed at recovering visual negative space.
Do not fill the freed space with anything at all, and do not propose doing that.

## Actions

This skill can be used in two modes:

### Improving an existing interface

### Creating an interface from scratch 

## Common user interface fallacies

### UIF0: UX is not focused on intent

How to detect & fix:

- write down a mapping between UI elements in an interface and user intents that guide the user interacting with the interface (use **understand-intent** skill to gather them)
- Pick one core intent (e.g. manage TODO entries) (ask the developer what to prioritize) and its concrete use cases (e.g. add entries, delete entries, edit entries)
- For every UI element, write down a reason why removing it would be at odds with fulfilling the core intent.
- If the reason is not convincing or absent, remove the element

### UIF1: Display-only and interactive elements are not visually separated

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

Non-actionable elements, remove:
- hover effects
- `pointer` or other non-standard cursor settings
- button-like styling
- box shadows, borders or other styling methods for popping them out of the background

A separate case of this problem is screenshots or interface mockups that are placed alongside content to demo the UX.
They can be confused with real interactive elements.
3D-tilt them, slightly rotate, apply shifted box shadow, or draw something on top (use **understand-intent** skill to decide)

### UIF6: call-to-action fatigue
