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

import React from "react";
import { capitalize } from "lodash-es";
import { NavItem } from "react-bootstrap";
import { Flex, FlexItem, Icon } from "virtool/js/components/Base";

/**
 * A component that renders to a primary link in the primary navbar.
 */
export default class ParentButton extends React.Component {

    static propTypes = {
        parentKey: React.PropTypes.string,
        iconName: React.PropTypes.string,
        label: React.PropTypes.string,
        active: React.PropTypes.bool
    };

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
    };

    render () {
        return (
            <NavItem onClick={this.handleClick} className="pointer" active={this.props.active}>
                <Flex>
                    <FlexItem>
                        <Icon name={this.props.iconName} />
                    </FlexItem>
                    <FlexItem pad={5}>
                        {this.props.label || capitalize(this.props.parentKey)}
                    </FlexItem>
                </Flex>
            </NavItem>
        );
    }
}

