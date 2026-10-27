/** Base classes shared by Input and TextArea */
export const inputBaseClasses =
	"bg-white border rounded min-w-0 block outline-none py-2 px-2.5 relative transition-[color,box-shadow] w-full placeholder:text-gray-500 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50";

/**
 * Explicit height shared by single-line form controls (text inputs, the Select
 * trigger, the ComboBox input) so they line up. Multi-line controls (textarea)
 * and chip containers use `min-h-10` instead so they can grow.
 */
export const inputHeightClass = "h-10";

/** Border and focus ring for form controls in their normal state */
export const inputFocusClasses =
	"border-gray-300 focus-visible:border-blue-500 focus-visible:ring-2 focus-visible:ring-blue-500/50";

/**
 * Border and focus ring for form controls marked invalid. Driven by
 * `aria-invalid` so the red treatment and the announcement to assistive
 * technology can never disagree — the attribute is the only source of truth.
 */
export const inputInvalidClasses =
	"aria-invalid:border-red-500 aria-invalid:focus-visible:border-red-500 aria-invalid:focus-visible:ring-2 aria-invalid:focus-visible:ring-red-500/50";

/**
 * Interaction and state classes shared by every Select item so hover,
 * keyboard-highlight, and disabled treatments stay consistent across the shared
 * item and the inline item renderings. Layout (padding, flex direction) is left
 * to each item.
 */
export const selectItemStateClasses =
	"relative select-none outline-none cursor-default hover:bg-gray-100 data-[highlighted]:bg-gray-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50";
