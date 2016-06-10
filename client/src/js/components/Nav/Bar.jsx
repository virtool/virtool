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

'use strict';

var React = require('react');

var PrimaryNavbar = require('./PrimaryNavbar.jsx');
var Secondary = require('./SecondaryNavbar.jsx');
var LostConnection = require('./LostConnection.jsx');

/**
 * A container component that renders the primary and secondary navigation bars.
 */
var Bar = React.createClass({

    getInitialState: function () {
        return {closed: false}
    },

    componentDidMount: function () {
        dispatcher.on('closed', this.showLostConnection);
    },

    componentWillUnmount: function () {
        dispatcher.off('closed', this.showLostConnection);
    },

    showLostConnection: function () {
        this.setState({closed: true});
    },

    render: function () {
        return (
            <div>
                <PrimaryNavbar router={dispatcher.router} />
                <Secondary router={dispatcher.router} />
                <LostConnection
                    show={this.state.closed}
                    onHide={this.showLostConnection}
                />
            </div>
        )
    }
});

module.exports = Bar;