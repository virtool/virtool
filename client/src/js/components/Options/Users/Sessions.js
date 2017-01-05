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

import React from "react";
import { isEqual } from "lodash-es";
import { Table, Panel } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base";

import Session from "./Session";

/**
 * Renders either a table describing the sessions associated with the user or a panel with a message indicating no
 * sessions are associated with that user.
 */
export default class Sessions extends React.Component {

    static propTypes = {
        sessions: React.PropTypes.arrayOf(React.PropTypes.object)
    };

    shouldComponentUpdate (nextProps) {
        return !isEqual(nextProps.sessions, this.props.sessions);
    }

    render () {

        let content;

        if (this.props.sessions.length > 0) {
            // Render the session rows containing an icon indicating the browser, the session token, and the time the
            // session was initialized.
            const sessionRows = this.props.sessions.map(session =>
                <Session
                    key={session.token}
                    ip={session.ip}
                    token={session.token}
                    timestamp={session.timestamp}
                    browserName={session.browser.name}
                />
            );

            content = (
                <Panel>
                    <Table fill>
                        <thead>
                            <tr>
                                <th className="col-sm-3">Client</th>
                                <th className="col-sm-5">Session Token</th>
                                <th className="col-sm-3">Created</th>
                                <th className="col-sm-1"></th>
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
                <Panel className="text-center">
                    <Icon name="notification" /> No sessions
                </Panel>
            );
        }

        return (
            <div>
                <h5><Icon name="pushpin" /> <strong>Sessions</strong></h5>
                {content}
            </div>
        )
    }
}
