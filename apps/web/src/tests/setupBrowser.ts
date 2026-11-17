// Setup for the Chromium `web` project.
//
// Do not import `./setup` or any app module here. A static app import loads the
// modules that tests mock before `vi.mock` applies, and every suite then fails
// to import.
//
// React's act environment stays on, so updates that land outside `act` show as
// warnings.
import "@app/style.css";
import { faker } from "@faker-js/faker";
import { configure } from "@testing-library/react";
import "./fakeEventSource";
import "./serverFnMocks";

faker.seed(1);

// Vite transforms a lazily imported module when the browser first requests it.
// On a cold CI run that can take longer than the 1 s default, so a `findBy` or
// `waitFor` behind a `lazy()` or dynamic `import()` would time out.
configure({ asyncUtilTimeout: 5000 });

// Radix keeps a closing overlay in the DOM until its exit animation ends, and
// the overlay keeps `aria-hidden` on the rest of the page until then.
const noMotion = document.createElement("style");
noMotion.textContent =
	"*, *::before, *::after { animation: none !important; transition: none !important; }";
document.head.append(noMotion);
