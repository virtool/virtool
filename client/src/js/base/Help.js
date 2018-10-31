import React from "react";
import PropTypes from "prop-types";
import CX from "classnames";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { Icon } from "./Icon";

/**
 * A component containing a question mark icon that shows a popover help message when clicked.
 *
 */
export const Help = props => {
    // The children of the component are shown in the popover.
    const popover = (
        <Popover title={props.title} id="help-popover">
            {props.children}
        </Popover>
    );

    const className = CX("pointer", {
        "pull-right": props.pullRight
    });

    return (
        <OverlayTrigger trigger="click" placement="top" overlay={popover} rootClose>
            <span className={className}>
                <Icon name="question-circle" />
            </span>
        </OverlayTrigger>
    );
};

Help.propTypes = {
    title: PropTypes.string,
    pullRight: PropTypes.bool,
    children: PropTypes.node.isRequired
};
