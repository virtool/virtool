/**
 * Hides a toolbar button's label, leaving its icon, once the toolbar runs out
 * of room.
 *
 * `2xl` is the narrowest built-in breakpoint above the width where the labels
 * stop fitting — around 1370px, where the buttons were shrinking far enough to
 * break their labels across two lines and push the results down the page. `xl`
 * is closer to that figure but sits below it, which would leave the wrap in
 * place on exactly the 1366px-wide laptops that hit it.
 *
 * The label is `hidden`, not `sr-only`, so each button carries the same text as
 * an `aria-label` — a hidden label is no longer the button's accessible name.
 */
export const collapsingLabel = "hidden 2xl:inline";
