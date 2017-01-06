/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports TaskField
 */

import CX from "classnames";
import React from "react";
import { Icon } from "virtool/js/components/Base";

/**
 * A component centered around an input element that updates a task-specific setting on the server. Shows pending save
 * requests by disabling the input and showing a spinner.
 */
export default class TaskField extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            value: this.getValue(),
            pending: false
        };
    }

    static propTypes = {
        set: React.PropTypes.func.isRequired,
        settings: React.PropTypes.object.isRequired,
        readOnly: React.PropTypes.bool,
        taskPrefix: React.PropTypes.string.isRequired,
        resource: React.PropTypes.string.isRequired
    };

    getValue = () => {
        return this.props.settings[`${this.props.taskPrefix}_${this.props.resource}`];
    };

    handleBlur = () => {
        if (!this.state.pending) {
            this.setState({value: this.getValue()});
        }
    };

    handleChange = (event) => {
        this.setState({value: event.target.value});
    };

    handleSubmit = (event) => {
        event.preventDefault();

        this.setState({pending: true}, () => {
            const key = `${this.props.taskPrefix}_${this.props.resource}`;

            this.props.set(key, this.state.value === "" ? 1: this.state.value)
                .success(() => this.setState({pending: false}))
                .failure(() => this.setState({pending: false}));
        });
    };

    render () {

        // Apply the "has-feedback" Bootstrap class to the input element if a setting save is pending.
        const groupClass = CX("form-group", {"has-feedback": this.state.pending || this.props.readOnly});

        let feedbackIcon;

        // If a settings save is pending show a spinner in the input element.
        if (this.state.pending || this.props.readOnly) {
            feedbackIcon = (
                <span className="form-control-feedback">
                    <Icon name="lock" pending={this.state.pending} />
                </span>
            );
        }

        return (
            <form onSubmit={this.handleSubmit}>
                <div className={groupClass}>
                    <input
                        key="input"
                        type="number"
                        className="form-control"
                        value={this.state.value}
                        onBlur={this.handleBlur}
                        onChange={(event) => this.handleChange(event)}
                        disabled={this.state.pending || this.props.readOnly}
                    />
                    {feedbackIcon}
                </div>
            </form>
        );
    }
}
