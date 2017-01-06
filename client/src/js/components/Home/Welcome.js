/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Welcome
 */

import React from "react";
import { Panel, Table } from "react-bootstrap";

export default class Welcome extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            settings: dispatcher.settings.data || null
        };
    }

    componentDidMount () {
        dispatcher.settings.on("change", this.update);
    }

    componentWillUnmount () {
        dispatcher.settings.off("change", this.update);
    }

    update = () => {
        this.setState({
            settings: dispatcher.settings.data
        });
    };

    render () {

        let content;

        if (this.state.settings) {

            content = (
                <div>
                    <Panel header="Virtool">
                        <a href="/doc/index.html?v=2" target="_blank">Documentation</a> (incomplete)
                    </Panel>
                    <Panel header="Server">
                        <Table fill bordered>
                            <tbody>
                                <tr>
                                    <th>Version</th>
                                    <td>{dispatcher.settings.get("server_version")}</td>
                                </tr>
                                <tr>
                                    <th>Address</th>
                                    <td>{this.state.settings.server_host}:{this.state.settings.server_port}</td>
                                </tr>
                                <tr>
                                    <th>Server ID</th>
                                    <td>{this.state.settings.server_id}</td>
                                </tr>
                            </tbody>
                        </Table>
                    </Panel>
                </div>
            );
        }

        return <div>{content}</div>;
    }
}
