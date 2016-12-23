/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports UserEntry
 */

'use strict';

import React from 'react';
import { Icon, ListGroupItem } from 'virtool/js/components/Base';

/**
 * A component based on ListGroupItem
 */
export default class UserEntry extends React.Component {

    /**
     * Called when the component is clicked. Selects the component's user in the parent component.
     */
    handleClick = () => {
        this.props.onClick(this.props._id);
    }

    render () {
        return (
            <ListGroupItem key={this.props._id} active={this.props.active} onClick={this.handleClick}>
                {this.props._id}
            </ListGroupItem>
        );
    }
}

