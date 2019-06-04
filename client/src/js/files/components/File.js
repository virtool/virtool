import React, { useCallback } from "react";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Col, Row } from "react-bootstrap";
import { removeFile } from "../actions";
import { byteSize, checkAdminOrPermission } from "../../utils/utils";
import { Icon, ListGroupItem, RelativeTime } from "../../base";

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
                Uploaded <RelativeTime time={uploaded_at} /> by {user.id}
            </span>
        );
    }

    return (
        <ListGroupItem className="spaced" style={{ color: "#555" }}>
            <Row>
                <Col xs={4} sm={4} md={4}>
                    <strong>{name}</strong>
                </Col>
                <Col xs={2} sm={2} md={2}>
                    {byteSize(size)}
                </Col>
                <Col xs={5} sm={5} md={5}>
                    {creation}
                </Col>
                <Col xs={1} sm={1} md={1}>
                    {canRemove ? (
                        <Icon
                            name="trash"
                            bsStyle="danger"
                            style={{ fontSize: "17px" }}
                            onClick={handleRemove}
                            pullRight
                        />
                    ) : null}
                </Col>
            </Row>
        </ListGroupItem>
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
