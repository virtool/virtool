/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports Lifecycle
 */

import React from "react";
import { Panel, ButtonToolbar } from "react-bootstrap";
import { Button, Icon } from "virtool/js/components/Base";

/**
 * A component that allows the addition and removal of allowed source types. The use of restricted source types can also
 * be toggled.
 */
export default class Lifecycle extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            pendingReload: false
        };
    }

    static propTypes = {
        set: React.PropTypes.func,
        settings: React.PropTypes.object
    };

    reload = () => {
        this.setState({pendingReload: true}, () => {
            dispatcher.send({interface: "dispatcher", method: "reload", message: {}}).success(() => {
                const domain = `${this.props.settings.server_address}:${this.props.settings.server_port}`;
                const protocol = dispatcher.settings.get("use_ssl") ? "https": "http";

                window.location.assign(`${protocol}://${domain}`);
            });
        });
    };

    shutdown = () => {
        window.location.hash = "#home/welcome";
        
        dispatcher.send({
            interface: "dispatcher",
            method: "shutdown",
            message: {}
        });
    };

    render = () => (
        <Panel>
            <ButtonToolbar>
                <Button bsStyle="warning" onClick={this.reload}>
                    <Icon name="reset" pending={this.state.pendingReload} /> Reload
                </Button>

                <Button bsStyle="danger" onClick={this.shutdown}>
                    <Icon name="switch" pending={this.state.pendingShutdown} /> Shutdown
                </Button>
            </ButtonToolbar>
        </Panel>
    )
}
