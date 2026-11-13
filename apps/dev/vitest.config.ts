import { playwright } from "@vitest/browser-playwright";
import { defineConfig } from "vitest/config";

export default defineConfig({
	test: {
		projects: [
			{
				test: {
					name: "server",
					environment: "node",
					include: ["src/server/**/*.test.ts"],
				},
			},
			{
				test: {
					name: "client",
					include: ["src/client/**/*.test.tsx"],
					browser: {
						enabled: true,
						provider: playwright(),
						headless: true,
						instances: [{ browser: "chromium" }],
						// A failed assertion already names the element and the
						// difference; a screenshot adds nothing and writes a PNG into
						// the source tree.
						screenshotFailures: false,
					},
				},
			},
		],
	},
});
