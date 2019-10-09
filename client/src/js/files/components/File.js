import React, { useCallback } from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import styled from "styled-components";

import { removeFile } from "../actions";
import { byteSize, checkAdminOrPermission } from "../../utils/utils";
import { Icon, ListGroupItem, RelativeTime } from "../../base";

const NameCreationSize = styled(ListGroupItem)`
    display: flex;
    justify-content: space-between;
`;

const NameCreation = styled.div`
    display: flex;
    align-items: flex-start;
    @media (max-width: 1080px) {
        flex-direction: column;
    }
`;

const Creation = styled.div`
    display: flex;
    margin-left: 9px;
    margin-top: 1px;
    font-size: 12px;
    @media (max-width: 1080px) {
        margin-left: 0;
        margin-top: 0;
    }
`;

export const File = ({ canRemove, entry, onRemove }) => {
    const handleRemove = useCallback(() => onRemove(entry.id), [entry.id]);

    const { name, size, uploaded_at, user } = entry;

    let creation;

    if (user === null) {
        creation = (
            <span>
                Retrieved <RelativeTime time={uploaded_at} />
            </span>
        );
    } else {
        creation = (
            <span>
                <span style={{ fontSize: 12 }}>
                    Uploaded <RelativeTime time={uploaded_at} />
                </span>{" "}
                by {user.id}
            </span>
        );
    }

    return (
        <NameCreationSize className="spaced">
            <NameCreation>
                <strong>{name}</strong>
                <Creation>{creation}</Creation>
            </NameCreation>
            <div>
                {byteSize(size)}
                {canRemove ? (
                    <Icon
                        name="trash"
                        bsStyle="danger"
                        style={{ fontSize: "17px", marginLeft: "9px" }}
                        onClick={handleRemove}
                        pullRight
                    />
                ) : null}
            </div>
        </NameCreationSize>
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

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(File);
