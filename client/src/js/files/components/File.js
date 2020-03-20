import React, { useCallback } from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import styled from "styled-components";

import { removeFile } from "../actions";
import { byteSize, checkAdminOrPermission } from "../../utils/utils";
import { Icon, RelativeTime, SpacedBox, device } from "../../base";

const StyledFile = styled(SpacedBox)`
    display: flex;
    justify-content: space-between;
`;

const FileHeader = styled.div`
    align-items: flex-start;
    display: flex;

    @media (max-width: ${device.desktop}) {
        flex-direction: column;
    }
`;

const Creation = styled.div`
    font-size: 12px;
    margin-left: 9px;
    margin-top: 1px;

    @media (max-width: ${device.desktop}) {
        margin: 0;
    }
`;

export const File = ({ canRemove, entry, onRemove }) => {
    const handleRemove = useCallback(() => onRemove(entry.id), [entry.id]);

    const { name, size, uploaded_at, user } = entry;

    let creation;

    if (user === null) {
        creation = (
            <React.Fragment>
                Retrieved <RelativeTime time={uploaded_at} />
            </React.Fragment>
        );
    } else {
        creation = (
            <React.Fragment>
                Uploaded <RelativeTime time={uploaded_at} /> by {user.id}
            </React.Fragment>
        );
    }

    return (
        <StyledFile>
            <FileHeader>
                <strong>{name}</strong>
                <Creation>{creation}</Creation>
            </FileHeader>
            <div>
                {byteSize(size)}
                {canRemove ? (
                    <Icon
                        name="trash"
                        color="red"
                        style={{ fontSize: "17px", marginLeft: "9px" }}
                        onClick={handleRemove}
                    />
                ) : null}
            </div>
        </StyledFile>
    );
};

export const mapStateToProps = (state, ownProps) => ({
    canRemove: checkAdminOrPermission(state, "remove_file"),
    entry: get(state, `files.documents[${ownProps.index}]`, null)
});

export const mapDispatchToProps = dispatch => ({
    onRemove: fileId => {
        dispatch(removeFile(fileId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(File);
