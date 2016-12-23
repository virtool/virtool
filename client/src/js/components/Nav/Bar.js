/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Bar
 */

"use strict";

import React from "react";
import ChildBar from "./Child/Bar";
import ParentBar from "./Parent/Bar";
import LostConnection from "./LostConnection";

/**
 * A container component that renders the primary and secondary navigation bars.
 */
var Bar = React.createClass({

    getInitialState: function () {
        return {closed: false}
    },

    componentDidMount: function () {
        dispatcher.on("closed", this.showLostConnection);
    },

    componentWillUnmount: function () {
        dispatcher.off("closed", this.showLostConnection);
    },

    showLostConnection: function () {
        this.setState({closed: true});
    },

    render: function () {
        return (
            <div>
                <ParentBar />
                <ChildBar />
                <LostConnection
                    show={this.state.closed}
                    onHide={this.showLostConnection}
                />
            </div>
        )
    }
});

module.exports = Bar;