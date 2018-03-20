import CX from "classnames";
import React from "react";
import PropTypes from "prop-types";
import { toNumber } from "lodash-es";
import { Icon, InputError } from "../../../base";

export default class TaskField extends React.PureComponent {

    constructor (props) {
        super(props);
        this.state = {
            value: this.props.value,
            pending: false
        };
    }

    static propTypes = {
        name: PropTypes.string,
        value: PropTypes.number,
        onChange: PropTypes.func,
        clear: PropTypes.func,
        readOnly: PropTypes.bool,
        lowerLimit: PropTypes.number,
        upperLimit: PropTypes.number,
        onInvalid: PropTypes.func
    };

    componentWillReceiveProps (nextProps) {
        if (nextProps.value !== this.state.value) {
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
        this.props.clear();
    };

    handleChange = (e) => {
        this.setState({
            value: toNumber(e.target.value)
        });
    };

    handleInvalid = (e) => {
        e.preventDefault();
        this.props.onInvalid();
    };

    handleSubmit = (e) => {
        e.preventDefault();

        if (this.state.value) {
            this.setState({pending: true}, () => {
                this.props.onChange(this.props.name, this.state.value);
            });
        } else {
            this.props.onInvalid();
        }
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
                    <InputError
                        type="number"
                        value={this.state.value}
                        min={this.props.lowerLimit}
                        max={this.props.upperLimit}
                        step={this.props.name === "mem" ? 0.1 : 1}
                        onBlur={this.handleBlur}
                        onChange={this.handleChange}
                        onInvalid={this.handleInvalid}
                        disabled={this.props.readOnly}
                        noError
                        noMargin
                    />
                    {feedbackIcon}
                </div>
            </form>
        );
    }
}
