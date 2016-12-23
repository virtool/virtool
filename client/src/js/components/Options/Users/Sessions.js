/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Sessions
 */

'use strict';

var _ = require('lodash');
import React from "react";
var Table = require('react-bootstrap/lib/Table');
var Panel = require('react-bootstrap/lib/Panel');

var Icon = require('virtool/js/components/Base/Icon');
var Session = require('./Session');

/**
 * Renders either a table describing the sessions associated with the user or a panel with a message indicating no
 * sessions are associated with that user.
 */
var Sessions = React.createClass({

    shouldComponentUpdate: function (nextProps) {
        return !_.isEqual(nextProps.sessions, this.props.sessions);
    },

    render: function () {

        var content;

        if (this.props.sessions.length > 0) {
            // Render the session rows containing an icon indicating the browser, the session token, and the time the
            // session was initialized.
            var sessionRows = this.props.sessions.map(function (session) {
                return <Session key={session.token} {...session} />;
            });

            content = (
                <Panel>
                    <Table fill>
                        <thead>
                            <tr>
                                <th className='col-sm-3'>Client</th>
                                <th className='col-sm-5'>Session Token</th>
                                <th className='col-sm-3'>Created</th>
                                <th className='col-sm-1'></th>
                            </tr>
                        </thead>
                        <tbody>
                            {sessionRows}
                        </tbody>
                    </Table>
                </Panel>
            );
        } else {
            content = (
                <Panel className='text-center'>
                    <Icon name='notification' /> No sessions
                </Panel>
            );
        }

        return (
            <div>
                <h5><Icon name='pushpin' /> <strong>Sessions</strong></h5>
                {content}
            </div>
        )


    }
});

module.exports = Sessions;