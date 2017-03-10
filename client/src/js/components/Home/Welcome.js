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
import { Panel, Table, ButtonToolbar } from "react-bootstrap";
import { Icon } from "virtool/js/components/Base"

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
                    <Panel>
                        <p>Viral infection diagnostics using next-generation sequencing</p>

                        <ButtonToolbar>
                            <a className="btn btn-default" href="http://www.virtool.ca/" target="_blank">
                                <Icon name="vtlogo" /> Website
                            </a>
                            <a className="btn btn-default" href="https://github.com/virtool/virtool" target="_blank">
                                <Icon name="github" /> Github
                            </a>
                            <a className="btn btn-default" href="/doc/index.html?v=2" target="_blank">
                                <Icon name="book" /> Documentation
                            </a>
                        </ButtonToolbar>
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
