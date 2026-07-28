// Setup for the browser-based `a11y` Vitest project. It deliberately does not
// reuse `setup.tsx`, which wires in the global server-function mocks and the
// jsdom-oriented providers that the lean, provider-free a11y tests never need.
//
// Loading the app stylesheet is the whole point: axe-core computes contrast
// from the *rendered* colours, so without the real Tailwind theme its classes
// resolve to nothing and every colour-contrast check passes vacuously.
import "@app/style.css";
