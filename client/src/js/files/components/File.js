import React from "react";
import PropTypes from "prop-types";
import { Col, Row } from "react-bootstrap";

import { byteSize } from "../../utils";
import { Icon, ListGroupItem, RelativeTime } from "../../base";

export default function File (props) {
    let creation;

    if (props.user === null) {
        creation = (
            <span>
                Retrieved <RelativeTime time={props.uploaded_at} />
            </span>
        );
    } else {
        creation = <span>Uploaded <RelativeTime time={props.uploaded_at} /> by {props.user.id}</span>;
    }

    return (
        <ListGroupItem className="spaced">
            <Row>
                <Col md={5}>
                    <strong>{props.name}</strong>
                </Col>
                <Col md={2}>
                    {byteSize(props.size)}
                </Col>
                <Col md={4}>
                    {creation}
                </Col>
                <Col md={1}>
                    <Icon
                        name="remove"
                        bsStyle="danger"
                        style={{fontSize: "17px"}}
                        pullRight onClick={() => props.onRemove(props.id)}
                    />
                </Col>
            </Row>
        </ListGroupItem>
    );
}

File.propTypes = {
    id: PropTypes.string,
    name: PropTypes.string,
    size: PropTypes.number,
    file: PropTypes.object,
    uploaded_at: PropTypes.string,
    user: PropTypes.object,
    onRemove: PropTypes.func
};
