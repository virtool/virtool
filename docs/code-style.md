# Code style

`AGENTS.md` holds the rules that apply while editing. This document explains
the rationale and shows the preferred forms.

## Functions and React refs

Use function declarations throughout the repository. Biome enforces this for
React components with `useReactFunctionComponentDefinition`; elsewhere it is a
convention that keeps function style consistent and gives declarations useful
names in stack traces.

React 19 treats `ref` as an ordinary prop, so wrappers do not need
`forwardRef`. Type the wrapper with `ComponentPropsWithRef` and pass the ref
through the props spread:

```tsx
function Input(props: ComponentPropsWithRef<"input">) {
  return <input {...props} />;
}
```

Besides being unnecessary, `forwardRef` turns the component into a function
expression and conflicts with the function-declaration rule.

## Imports, conditionals, and variables

Biome owns import ordering and unused-import cleanup. Let `pnpm check` apply
those mechanical changes instead of arranging imports by hand.

Always put braces around `if` and `else` bodies. Prefer `const`; use `let` only
when the binding itself must be reassigned.

## Types and JSDoc

Use `type` rather than `interface`. Biome enforces this with
`useConsistentTypeDefinitions`; the exceptions are declarations that must use
interface merging, such as framework module or global augmentation.

Every exported type needs a one-line JSDoc label. Start with what the type is
so the useful label appears first in editor hovers:

```ts
/** The configuration for a workflow run. */
export type WorkflowConfig = {
  image: string;
};
```

## Naming

Use `is`, `has`, or `get` for pure reads and `check`, `validate`, or `assert`
for operations that may throw. This is a guide to the operation's contract,
not a rigid vocabulary: prefer `getLifetime` to a prepositional name such as
`lifetimeFor`.

A `createServerFn` export is an RPC boundary, so suffix its name with `Fn` to
mark that boundary at every call site. The domain function it wraps keeps the
unsuffixed name and does not cross the network:

```ts
import { listGroups } from "./data";

export const listGroupsFn = createServerFn({ method: "GET" })
  .middleware([authenticated()])
  .handler(async () => listGroups(db));
```

Import the domain function into `functions.ts` under its own name. The `Fn`
suffix already distinguishes the RPC export, so aliases such as
`listGroupsImpl` add no information.

## Comments

Default to no comment. Add one when the reason for a choice is non-obvious,
and explain that reason rather than restating the code. Do not reference the
current task or a particular caller because both become stale when code moves.

Do not narrate history. Git records what changed. If reverting a detail would
silently restore a bug, phrase the comment as a standing warning about the
constraint instead of a changelog entry.

Use `/** ... */` for the required exported-type label and for the occasional
function or constant that benefits from API documentation. Use `/* ... */` for
a multi-line explanation and `//` for a one-line explanation; do not assemble
a block from consecutive `//` lines.

## Concurrent awaits

Run independent asynchronous operations together so total latency is bounded
by the slowest operation rather than the sum:

```ts
const [user, settings] = await Promise.all([
  getUser(userId),
  getSettings(userId),
]);
```

Keep awaits sequential when the later call needs an earlier result, when both
calls share a Postgres transaction that serializes them server-side, or when an
early failure should prevent an expensive later operation. Use
`Promise.allSettled` when all operations must finish and every outcome is
needed even if some fail.
