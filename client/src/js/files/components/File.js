import React from "react";
import PropTypes from "prop-types";
import { get } from "lodash-es";
import { connect } from "react-redux";
import { Col, Row } from "react-bootstrap";
import { removeFile } from "../actions";
import { byteSize } from "../../utils/utils";
import { Icon, ListGroupItem, RelativeTime } from "../../base";

export class File extends React.Component {
    static propTypes = {
        index: PropTypes.number,
        entry: PropTypes.object,
        canRemove: PropTypes.bool,
        onRemove: PropTypes.func
    };

    handleRemove = () => {
        this.props.onRemove(this.props.entry.id);
    };

    render() {
        const { name, size, uploaded_at, user } = this.props.entry;

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
                        {this.props.canRemove ? (
                            <Icon
                                name="trash"
                                bsStyle="danger"
                                style={{ fontSize: "17px" }}
                                onClick={this.handleRemove}
                                pullRight
                            />
                        ) : null}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}

const mapStateToProps = (state, props) => ({
    entry: get(state, `files.documents[${props.index}]`, null)
});

const mapDispatchToProps = dispatch => ({
    onRemove: fileId => {
        dispatch(removeFile(fileId));
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(File);
