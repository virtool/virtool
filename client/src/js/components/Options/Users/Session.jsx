/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Session
 */

'use strict';

var React = require('react');
var Icon = require('virtool/js/components/Base/Icon.jsx');
var RelativeTime = require('virtool/js/components/Base/RelativeTime.jsx');

var Session = React.createClass({

    getInitialState: function () {
        return {
            pending: false
        };
    },

    remove: function () {
        this.setState({pending: true}, function () {
            dispatcher.db.users.request('remove_session', {
                token: this.props.token
            });
        });
    },

    render: function () {
        return (
            <tr disabled={this.state.pending}>
                <td><Icon name={this.props.browser.name.toLowerCase()}/> {this.props.ip}</td>
                <td>{this.props.token}</td>
                <td><RelativeTime time={this.props.timestamp}/></td>
                <td><Icon name='remove' bsStyle='danger' onClick={this.remove} pullRight/></td>
            </tr>
        );
    }
});

module.exports = Session;