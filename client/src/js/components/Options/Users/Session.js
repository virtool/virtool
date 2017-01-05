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

import React from "react";
import { Icon, RelativeTime } from "virtool/js/components/Base";

export default class Session extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            pending: false
        };
    }

    static propTypes = {
        ip: React.PropTypes.string,
        token: React.PropTypes.string,
        timestamp: React.PropTypes.string,
        browserName: React.PropTypes.string
    };

    remove = () => {
        this.setState({pending: true}, () => {
            dispatcher.db.users.request("remove_session", {
                token: this.props.token
            });
        });
    };

    render = () => (
        <tr disabled={this.state.pending}>
            <td><Icon name={this.props.browserName.toLowerCase()}/> {this.props.ip}</td>
            <td>{this.props.token}</td>
            <td><RelativeTime time={this.props.timestamp}/></td>
            <td><Icon name="remove" bsStyle="danger" onClick={this.remove} pullRight/></td>
        </tr>
    );
}
