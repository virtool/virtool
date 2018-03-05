import React from "react";
import { Input, InputSave } from "./index";

/**
 * A wrapper for Input and InputSave 
 */
export class InputError extends React.Component {
    constructor (props) {
        super(props);
    }

    renderInput = () => {
        return <Input {...this.props} />;
    }

    renderInputSave = () => {
        return <InputSave {...this.props} />;
    }

    render () {

        const renderInputType = this.props.withButton ? this.renderInputSave : this.renderInput;

        return (
            <div>
                {renderInputType()}
            </div>
        );
    }
}
