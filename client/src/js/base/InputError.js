import React from "react";
import PropTypes from "prop-types";
import { Input, InputSave } from "./index";

/**
 * A wrapper for Input and InputSave
 */
export class InputError extends React.Component {
    constructor(props) {
        super(props);
    }

    renderInput = () => <Input {...this.props} noMargin />;

    renderInputSave = () => <InputSave {...this.props} />;

    render() {
        const error = this.props.error;

        const inputErrorClassName = error ? "input-form-error" : "input-form-error-none";

        const renderInputType = this.props.withButton ? this.renderInputSave : this.renderInput;
        const errorDisplayType = <span className="input-error-message">{error ? error : "None"}</span>;

        const errorMessage = this.props.noError ? null : <div className={inputErrorClassName}>{errorDisplayType}</div>;

        return (
            <div>
                {renderInputType()}
                {errorMessage}
            </div>
        );
    }
}

InputError.propTypes = {
    error: PropTypes.string,
    withButton: PropTypes.bool,
    noError: PropTypes.bool
};
