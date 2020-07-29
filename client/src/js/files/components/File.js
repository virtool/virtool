import { find } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../app/theme";
import { Icon, RelativeTime, SpacedBox } from "../../base";
import { byteSize, checkAdminOrPermission } from "../../utils/utils";

import { removeFile } from "../actions";
import { getFilesById } from "../selectors";

const FileHeader = styled.div`
    align-items: center;
    display: flex;
    font-size: ${getFontSize("lg")};

    span {
        margin-left: auto;

        span {
            font-weight: ${getFontWeight("thick")};
            margin-right: 10px;
        }
    }
`;

const FileAttribution = styled.span`
    font-size: ${props => props.theme.fontSize.md};
`;

export const File = ({ canRemove, id, name, size, uploadedAt, user, onRemove }) => {
    const handleRemove = useCallback(() => onRemove(id), [id]);

    let attribution;

    if (user === null) {
        attribution = (
            <FileAttribution>
                Retrieved <RelativeTime time={uploadedAt} />
            </FileAttribution>
        );
    } else {
        attribution = (
            <FileAttribution>
                Uploaded <RelativeTime time={uploadedAt} /> by {user.id}
            </FileAttribution>
        );
    }

    return (
        <SpacedBox>
            <FileHeader>
                <strong>{name}</strong>
                <span>
                    <span>{byteSize(size)}</span>
                    {canRemove && (
                        <Icon
                            name="trash"
                            color="red"
                            style={{ fontSize: "17px", marginLeft: "9px" }}
                            onClick={handleRemove}
                        />
                    )}
                </span>
            </FileHeader>
            {attribution}
        </SpacedBox>
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
