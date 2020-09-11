import { find } from "lodash-es";
import React, { useCallback } from "react";
import { connect } from "react-redux";
import styled from "styled-components";
import { getFontSize, getFontWeight } from "../../app/theme";
import { Icon, Loader, RelativeTime, SpacedBox } from "../../base";
import { byteSize, checkAdminOrPermission } from "../../utils/utils";

import { removeFile } from "../actions";
import { getFilesById } from "../selectors";

const FileAttribution = styled.span`
    font-size: ${getFontSize("md")};
`;

const FileHeader = styled.div`
    align-items: center;
    display: flex;
    font-size: ${getFontSize("lg")};
    font-weight: ${getFontWeight("thick")};

    strong {
        font-weight: ${getFontWeight("thick")};
    }

    span {
        margin-left: auto;

        span {
            margin-right: 10px;
        }
    }
`;

export const File = ({ canRemove, id, name, ready, size, uploadedAt, user, onRemove }) => {
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

    let right;

    if (ready) {
        right = (
            <div>
                <span>{byteSize(size)}</span>
                {canRemove && (
                    <Icon
                        name="trash"
                        color="red"
                        style={{ fontSize: "17px", marginLeft: "9px" }}
                        onClick={handleRemove}
                    />
                )}
            </div>
        );
    } else {
        right = (
            <span>
                <Loader size="14px" /> <strong>Processing</strong>
            </span>
        );
    }

    return (
        <SpacedBox>
            <FileHeader>
                <strong>{name}</strong>
                {attribution}
            </FileHeader>
            {right}
        </SpacedBox>
    );
};

export const mapStateToProps = (state, ownProps) => {
    const { id, name, uploaded_at, ready, size, user } = find(getFilesById(state), { id: ownProps.id });

    return {
        id,
        name,
        ready,
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
