import React from "react";
import { Input, InputSave } from "./index";

/**
 * A wrapper for Input and InputSave
 */
export class InputError extends React.Component {
    constructor (props) {
        super(props);
    }

    renderInput = () => (
        <Input {...this.props} noMargin />
    )

    renderInputSave = () => (
        <InputSave {...this.props} />
    )

    render () {

        const error = this.props.error;

        const inputErrorClassName = error ? "input-form-error" : "input-form-error-none";

        let renderInputType;
        let errorDisplayType;

        if (this.props.withButton) {
            renderInputType = this.renderInputSave;
            errorDisplayType = error
                ? (<span className="input-error-message">{error}</span>)
                : null;
        } else {
            renderInputType = this.renderInput;
            errorDisplayType = <span className="input-error-message">{error ? error : "None"}</span>;
        }

        const errorMessage = (
            <div className={inputErrorClassName}>
                {errorDisplayType}
            </div>
        );

        return (
            <div>
                {renderInputType()}
                {errorMessage}
            </div>
        );
    }
}
