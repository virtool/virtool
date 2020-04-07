import { find } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { device, Icon, RelativeTime, SpacedBox } from "../../base";
import { byteSize, checkAdminOrPermission } from "../../utils/utils";

import { removeFile } from "../actions";
import { getFilesById } from "../selectors";

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

export const File = ({ canRemove, id, name, size, uploadedAt, user, onRemove }) => {
    const handleRemove = useCallback(() => onRemove(id), [id]);

    let creation;

    if (user === null) {
        creation = (
            <React.Fragment>
                Retrieved <RelativeTime time={uploadedAt} />
            </React.Fragment>
        );
    } else {
        creation = (
            <React.Fragment>
                Uploaded <RelativeTime time={uploadedAt} /> by {user.id}
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

export const mapStateToProps = (state, ownProps) => {
    const { id, name, uploaded_at, size, user } = find(getFilesById(state), { id: ownProps.id });

    return {
        id,
        name,
        size,
        user,
        canRemove: checkAdminOrPermission(state, "remove_file"),
        uploadedAt: uploaded_at
    };
};

export const mapDispatchToProps = dispatch => ({
    onRemove: fileId => {
        dispatch(removeFile(fileId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(File);
