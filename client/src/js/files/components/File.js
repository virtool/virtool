import React, { useCallback } from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import styled from "styled-components";

import { removeFile } from "../actions";
import { byteSize, checkAdminOrPermission } from "../../utils/utils";
import { Icon, ListGroupItem, RelativeTime } from "../../base";

const StyledChange = styled(ListGroupItem)`
    display: flex;
    flex-direction: row;

    justify-content: space-between;
    @media (max-width: 1080px) {
        display: flex;
        /* flex-flow: row wrap;
        flex-direction: column; */
        /* justify-content: flex-start; */
    }
`;

const NameCreation = styled.div`
    display: flex;
    align-items: flex-start;
    @media (max-width: 1080px) {
        flex-direction: column;
    }
`;

const SizeTrashCan = styled.section`
    @media (max-width: 1080px) {
    }
`;

const Creation = styled.section`
    display: flex;
    margin-left: 9px;
    font-size: 12px;
    margin-top: 1px;
    @media (max-width: 1080px) {
        flex-direction: row;
        margin-left: 0px;
        margin-top: 0px;
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
        <StyledChange>
            <NameCreation>
                <strong>{name}</strong>
                <Creation>{creation}</Creation>
            </NameCreation>
            <SizeTrashCan>
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
            </SizeTrashCan>
        </StyledChange>
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
