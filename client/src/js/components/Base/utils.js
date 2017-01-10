import { assign } from "lodash";

export const bsStyles = ["primary", "success", "danger", "warning", "info", "default"];

const flipMoveProps = {
    typeName: "div",
    className: "list-group",
    duration: 200,
    staggerDurationBy: 20,
    leaveAnimation: false
};

export const getFlipMoveProps = (options) => {
    return assign({}, flipMoveProps, options);
};
