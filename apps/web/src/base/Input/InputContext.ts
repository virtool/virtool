import React, { useContext } from "react";

const InputContext = React.createContext("");

InputContext.displayName = "InputContext";

/**
 * Whether a form control should be marked invalid, given its own error and any
 * error set on a surrounding `InputGroup`.
 */
export function useIsInvalid(error?: string): boolean {
	const contextError = useContext(InputContext);
	return Boolean(error || contextError);
}

export default InputContext;
