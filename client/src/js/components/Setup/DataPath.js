/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupDataPath
 *
 */

import React from "react";
import { includes } from "lodash-es";
import { Alert } from "react-bootstrap";

import { Icon, Input, Button } from "virtool/js/components/Base";
import { postJSON } from "virtool/js/utils";

export default class SetupDataPath extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            dataPath: this.props.dataPath || "data",
            feedback: null
        };
    }

    static propTypes = {
        name: React.PropTypes.string,
        names: React.PropTypes.arrayOf(React.PropTypes.string),
        host: React.PropTypes.string,
        port: React.PropTypes.number,
        dataPath: React.PropTypes.string,
        hasCollections: React.PropTypes.bool,

        updateSetup: React.PropTypes.func,
        nextStep: React.PropTypes.func
    };

    componentDidMount () {
        this.refs.input.focus();
    }

    handleChange = (event) => {
        let data = {};
        data[event.target.name] = event.target.value;
        this.setState(data);
    };

    handleSubmit = (event) => {
        event.preventDefault();

        const args = {
            operation: "set_data_path",
            host: this.props.host,
            port: this.props.port,
            name: this.props.name,
            path: this.state.dataPath,
            new_server: !includes(this.props.names, this.props.name)
        };

        this.setState({pending: true, feedback: false}, function () {
            postJSON("/", args, this.onComplete);
        });
    };

    onComplete = (data) => {
        this.setState({pending: false}, () => {
            if (data.failed) {
                this.setState({
                    feedback: data
                });
            } else {
                this.props.updateSetup({
                    dataPath: this.state.dataPath
                }, this.props.nextStep);
            }
        });
    };

    dismissError = () => this.setState({errors: null});

    render () {

        let warning;

        if (this.props.hasCollections) {
            warning = (
                <Alert bsStyle="danger">
                    <span>
                        The chosen database already exists and contains Virtool data collections. These collections
                        require matching files in the filesystem data path to work properly. Virtool will attempt to
                        make sure that the selected database and data path are compatible.
                    </span>
                </Alert>
            );
        }

        let error;

        if (this.state.feedback) {
            error = (
                <Alert bsStyle="danger" onDismiss={this.dismissError}>
                    {this.state.feedback.message}
                </Alert>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <Alert bsStyle="info">
                    Virtool will use this path to store and read data including sample reads, viral and host references,
                    and logs. The path is relative to Virtool"s working directory unless prepended with
                    <strong>/</strong>.
                </Alert>

                {warning}

                <Input
                    ref="input"
                    type="text"
                    name="dataPath"
                    label="Path"
                    onChange={this.handleChange}
                    value={this.state.dataPath}
                />

                {error}

                <Button bsStyle="primary" className="pull-right" type="submit">
                    <Icon name="floppy" /> Save
                </Button>
            </form>
        );
    }

}
