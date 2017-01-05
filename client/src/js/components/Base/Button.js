/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Button
 */

import React from "react";
import { omit } from "lodash";
import { Button as BsButton, Tooltip, OverlayTrigger } from "react-bootstrap";

/**
 * A react-bootstrap button that does not retain focus when clicked.
 */
export class Button extends React.Component {

    static propTypes = {
        tip: React.PropTypes.oneOfType([React.PropTypes.string, React.PropTypes.element]),
        tipPlacement: React.PropTypes.oneOf(["top", "right", "bottom", "left"]),
        pullRight: React.PropTypes.bool
    };

    static defaultProps = {
        pullRight: false
    };

    /**
     * Function to call when the button becomes focused. Immediately blurs focus.
     *
     * @param event - the focus event
     */
    blur = (event) =>  {
        event.target.blur();
    };

    render () {

        const props = omit(this.props, "pullRight", "tip", "tipPlacement");

        const button = (
            <BsButton
                {...props}
                onFocus={this.blur}
                className={this.props.pullRight ? "pull-right": null}
            />
        );

        if (this.props.tip) {

            const tooltip = (
                <Tooltip id={this.props.tip}>
                    {this.props.tip}
                </Tooltip>
            );

            return (
                <OverlayTrigger placement={this.props.tipPlacement || "top"} overlay={tooltip}>
                    {button}
                </OverlayTrigger>
            )
        }

        return button;
    }

}
