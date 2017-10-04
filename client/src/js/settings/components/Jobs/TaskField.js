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
import PropTypes from "prop-types";
import { toNumber } from "lodash";
import { Icon } from "../../../base";

/**
 * A component centered around an input element that updates a task-specific setting on the server. Shows pending save
 * requests by disabling the input and showing a spinner.
 */
export default class TaskField extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            value: this.props.value,
            pending: false
        };
    }

    static propTypes = {
        value: PropTypes.number,
        onChange: PropTypes.func,
        readOnly: PropTypes.bool
    };

    componentWillReceiveProps (nextProps) {
        if (nextProps.value !== this.props.value) {
            this.setState({
                value: nextProps.value,
                pending: false
            });
        }
    }

    handleBlur = () => {
        if (!this.state.pending) {
            this.setState({value: this.props.value});
        }
    };

    handleChange = (event) => {
        this.setState({
            value: toNumber(event.target.value)
        });
    };

    handleSubmit = (event) => {
        event.preventDefault();
        this.setState({pending: true},  () => {
            this.props.onChange(this.state.value);
            this.inputNode.blur();
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
                        ref={(node) => this.inputNode = node}
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
