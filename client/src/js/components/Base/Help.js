/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Help
 */

import React from "react";
import CX from "classnames";
import { Popover, OverlayTrigger } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

export default class Help extends React.Component {

    static propTypes = {
        title: React.PropTypes.string,
        pullRight: React.PropTypes.bool
    };

    render () {
        const popover = (
            <Popover title={this.props.title} id="help-popover">
                {this.props.children}
            </Popover>
        );

        const classes = CX("pointer", {
            "pull-right": this.props.pullRight
        });

        return (
            <OverlayTrigger trigger="click" placement="top" overlay={popover} rootClose>
                <span className={classes}>
                    <Icon name="question" />
                </span>
            </OverlayTrigger>
        );
    }

}