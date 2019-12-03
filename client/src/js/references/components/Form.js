import React from "react";
import styled from "styled-components";
import { InputError } from "../../base";

const Name = styled.div`
    display: flex;
    flex-direction: column;
    width: ${props => (props.mode == "create" ? "49%" : "100%")};
`;

const Organism = styled.div`
    display: flex;
    flex-direction: column;
    width: 49%;
`;

const NameOrganism = styled.div`
    display: flex;
    flex-direction: row;
    justify-content: space-between;
`;

export const ReferenceForm = ({ errorFile, errorSelect, name, onChange, errorName, description, organism, mode }) => {
    let extraComponent;
    let inputOrganism;

    if (errorFile != null || errorSelect != null) {
        extraComponent = (
            <div className="input-form-error">
                <span className="input-error-message" style={{ margin: "0 0 0 0" }}>
                    {errorFile || errorSelect}
                </span>
            </div>
        );
    }
    if (mode == "create") {
        inputOrganism = (
            <Organism>
                <InputError label="Organism" name="organism" value={organism} onChange={onChange} />
            </Organism>
        );
    }

    return (
        <div>
            <div>{extraComponent}</div>
            <NameOrganism>
                <Name mode={mode}>
                    <InputError label="Name" name="name" value={name} onChange={onChange} error={errorName} />
                </Name>
                {inputOrganism}
            </NameOrganism>

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
