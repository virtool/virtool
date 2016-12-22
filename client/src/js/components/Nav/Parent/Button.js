/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports PrimaryButton
 */

"use strict";

import React from "react";
import {capitalize} from "lodash";
import {NavItem} from "react-bootstrap";
import Flex from "virtool/js/components/Base/Flex.jsx";
import Icon from "virtool/js/components/Base/Icon.jsx";

/**
 * A component that renders to a primary link in the primary navbar.
 */
export default class ParentButton extends React.Component {

    shouldComponentUpdate (nextProps) {
        return nextProps.active !== this.props.active;
    }

    /**
     * Callback triggered by clicking on the primary button. Changes the primary route in the router to that
     * associated with the button.
     *
     * @param event {object} - the click event.
     */
    handleClick = (event) => {
        event.preventDefault();
        dispatcher.router.setParent(this.props.parentKey);
    }

    render () {
        return (
            <NavItem onClick={this.handleClick} className="pointer" active={this.props.active}>
                <Flex>
                    <Flex.Item>
                        <Icon name={this.props.iconName} />
                    </Flex.Item>
                    <Flex.Item pad={5}>
                        {this.props.label || capitalize(this.props.parentKey)}
                    </Flex.Item>
                </Flex>
            </NavItem>
        );
    }
}

