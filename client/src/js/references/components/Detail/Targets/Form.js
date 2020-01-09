import React from "react";
import styled from "styled-components";
import { Input } from "../../../../base";

const StyledRequire = styled.div`
    display: flex;
    flex-direction: row;
    align-items: center;
`;
export const TargetForm = ({ onChange, name, description, length, required }) => {
    return (
        <div>
            <Input label="Name" name="name" value={name} onChange={onChange} />
            <Input label="Description" name="description" value={description} onChange={onChange} />
            <Input type="number" label="Length" name="length" value={length} onChange={onChange} />
            <StyledRequire>
                <input type="checkbox" name="required" checked={required} onChange={onChange} />
                Required
            </StyledRequire>
        </div>
    );
};
