import React from "react";
import styled from "styled-components";
import { InputError } from "../../base";

const ReferenceFormInputs = styled.div`
    display: grid;
    grid-gap: 15px;
    grid-template-columns: 1fr ${props => (props.mode === "create" ? "1fr" : "")};
`;

export const ReferenceForm = ({ errorFile, errorSelect, name, onChange, errorName, description, organism, mode }) => {
    let errorComponent;
    let organismComponent;

    if (errorFile != null || errorSelect != null) {
        errorComponent = (
            <div className="input-form-error">
                <span className="input-error-message" style={{ margin: "0 0 0 0" }}>
                    {errorFile || errorSelect}
                </span>
            </div>
        );
    }

    if (mode === "create") {
        organismComponent = <InputError label="Organism" name="organism" value={organism} onChange={onChange} />;
    }

    return (
        <div>
            {errorComponent}

            <ReferenceFormInputs mode={mode}>
                <InputError label="Name" name="name" value={name} onChange={onChange} error={errorName} />
                {organismComponent}
            </ReferenceFormInputs>

            <InputError
                label="Description"
                type="textarea"
                name="description"
                value={description}
                onChange={onChange}
            />
        </div>
    );
};
