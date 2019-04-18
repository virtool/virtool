/**
 * Utility constants for use with base components.
 *
 * @module base/utils
 */
import { get } from "lodash-es";

/**
 * An array of all the acceptable Bootstrap styles that can be used in react-bootstrap.
 *
 * @type object
 */
export const bsStyles = ["primary", "success", "danger", "warning", "info", "default"];

export const colors = {
    blue: "#07689d",
    green: "#3c763d",
    grey: "#dddddd",
    red: "#af3227",
    yellow: "#be9235"
};

export const getColor = color => get(colors, color, "#f5f5f5");
