/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SetupWatchPath
 *
 */

import React from "react";
import { Alert } from "react-bootstrap";
import { Button, Icon, Input } from "virtool/js/components/Base";

export default class SetupWatchPath extends React.Component {

    constructor (props) {
        super(props);
        this.state = {
            watchPath: this.props.watchPath || "watch"
        }
    }
    
    static propTypes = {
        watchPath: React.PropTypes.string,
        updateSetup: React.PropTypes.func,
        nextStep: React.PropTypes.func
    };

    componentDidMount () {
        this.inputNode.focus();
    }

    handleSubmit = (event) => {
        event.preventDefault();

        this.props.updateSetup({
            watchPath: this.state.watchPath
        }, this.props.nextStep);
    };

    render () {
        return (
            <form onSubmit={this.handleSubmit}>
                <Alert bsStyle="info">
                    Sequence files in this path will be visible and importable in Virtool.
                </Alert>

                <Input
                    ref="input"
                    type="text"
                    label="Path"
                    onChange={(event) => this.setState({watchPath: event.target.value})}
                    value={this.state.watchPath}
                />

                <Button bsStyle="primary" className="pull-right" type="submit">
                    <Icon name="floppy" /> Save
                </Button>
            </form>
        );
    }

}
