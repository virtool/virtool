import { filter, map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Attribution, BoxGroup, InputError, NoneFoundBox, SelectBoxGroupSection } from "../../base";

const StyledSubtractionFileItem = styled(SelectBoxGroupSection)`
    display: flex;

    ${Attribution} {
        margin-left: auto;
    }
`;

export const SubtractionFileItem = ({ active, onClick, name, uploaded_at, user, id, error }) => {
    const handleClick = () => {
        onClick(id);
    };

    return (
        <StyledSubtractionFileItem active={active} onClick={handleClick} error={error}>
            <strong>{name}</strong>
            <Attribution user={user.id} time={uploaded_at} />
        </StyledSubtractionFileItem>
    );
};

const SubtractionFileSelectorError = styled(InputError)`
    margin-bottom: 5px;
`;

const SubtractionFileSelectorList = styled(BoxGroup)`
    margin-bottom: 5px;
`;

export const SubtractionFileSelector = ({ files, value, onClick, error }) => {
    const fileComponents = map(files, file => (
        <SubtractionFileItem key={file.id} {...file} active={file.id === value} onClick={onClick} error={error} />
    ));
    if (!fileComponents.length) {
        return (
            <NoneFoundBox noun="files">
                <Link to="/subtraction/files">Upload some</Link>
            </NoneFoundBox>
        );
    }
    return (
        <React.Fragment>
            <SubtractionFileSelectorList>{fileComponents}</SubtractionFileSelectorList>
            <SubtractionFileSelectorError>{error}</SubtractionFileSelectorError>
        </React.Fragment>
    );
};

const mapStateToProps = state => ({
    files: filter(state.files.documents, { type: "subtraction" })
});

export default connect(mapStateToProps)(SubtractionFileSelector);
