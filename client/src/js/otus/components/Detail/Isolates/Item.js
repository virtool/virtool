import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getActiveShadow } from "../../../../app/theme";
import { BoxGroupSection, Icon } from "../../../../base";
import { formatIsolateName } from "../../../../utils/utils";

const StyledIsolateItem = styled(BoxGroupSection)`
    align-items: center;
    border: none;
    box-shadow: ${getActiveShadow};
    display: flex;

    & > span {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
    }

    i.fas {
        margin-left: auto;
    }
`;

export const IsolateItem = props => {
    const handleSelectIsolate = useCallback(() => {
        props.onClick(props.id);
    }, [props.id]);

    return (
        <StyledIsolateItem active={props.active} onClick={handleSelectIsolate}>
            <span>{formatIsolateName(props)}</span>
            {props.default && props.dataType !== "barcode" && <Icon name="star" />}
        </StyledIsolateItem>
    );
};

export const mapStateToProps = state => ({
    dataType: state.references.detail.data_type
});

export default connect(mapStateToProps)(IsolateItem);
