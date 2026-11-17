# Code style

`AGENTS.md` holds the rules. This document gives the reasons and the preferred
forms that a lint rule can't show.

## Functions and React refs

Function declarations keep one style across the repository and give useful names
in stack traces.

React 19 treats `ref` as an ordinary prop. Type a wrapper with
`ComponentPropsWithRef` and pass the ref through the props spread:

```tsx
function Input(props: ComponentPropsWithRef<"input">) {
  return <input {...props} />;
}
```

`forwardRef` turns the component into a function expression, which conflicts with
the function-declaration rule.

## Types and JSDoc

The `type` rule has one exception: a declaration that relies on interface merging
in a framework module or the global scope.

Start each exported-type label with what the type is, so that the useful text
comes first in editor hovers:

```ts
/** The configuration for a workflow run. */
export type WorkflowConfig = {
  image: string;
};
```

## Naming

The `is`, `has`, `get`, `check`, `validate`, and `assert` prefixes guide the
reader to the contract of an operation. They aren't a fixed vocabulary, but
prefer `getLifetime` to a prepositional name such as `lifetimeFor`.

A `createServerFn` export is an RPC boundary. The `Fn` suffix marks that boundary
at every call site. The domain function that it wraps doesn't cross the network,
so it keeps the unsuffixed name:

```ts
import { listGroups } from "./data";

export const listGroupsFn = createServerFn({ method: "GET" })
  .middleware([authenticated()])
  .handler(async () => listGroups(db));
```

Import the domain function under its own name. The suffix already separates the
two, so an alias such as `listGroupsImpl` adds no information.

## Comments

A reference to the current task, a caller, an issue, or a pull request goes stale
when code moves. Git records what changed. If a revert would silently restore a
bug, write the comment as a standing warning about the constraint, not as a
changelog entry.

Use `/** ... */` for the exported-type label and for a function or constant that
benefits from API documentation. Use `//` for other explanations.

## Concurrent awaits

`Promise.all` limits total latency to the slowest operation, not the sum.

Keep awaits sequential when a later call needs an earlier result, when the calls
share a Postgres transaction that serializes them, or when an early failure must
prevent an expensive later operation.
