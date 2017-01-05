/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports DatabaseOptions
 */

import React from "react";
import { Panel } from "react-bootstrap";
import { InputSave } from "virtool/js/components/Base";

/**
 * A form component for changing settings for connection to the VT MongoDB database.
 */
export default class DatabaseOptions extends React.PureComponent {

    static propTypes = {
        settings: React.PropTypes.object,
        set: React.PropTypes.func
    };

    handleSave = (data) => {
        this.props.set(data.name, data.value);
    };

    render = () => (
        <Panel>
            <InputSave
                label="Database Name"
                name="db_name"
                onSave={this.handleSave}
                initialValue={this.props.settings.db_name}
            />
            <InputSave
                label="MongoDB Host"
                name="db_host"
                onSave={this.handleSave}
                initialValue={this.props.settings.db_host}
            />
            <InputSave
                label="MongoDB Port"
                name="db_port"
                type="number"
                onSave={this.handleSave}
                initialValue={this.props.settings.db_port}
            />
        </Panel>
    )
}
