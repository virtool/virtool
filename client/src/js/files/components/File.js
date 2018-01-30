import React from "react";
import PropTypes from "prop-types";
import { Col, Row } from "react-bootstrap";

import { byteSize } from "../../utils";
import { Icon, ListGroupItem, RelativeTime } from "../../base";

export default class File extends React.Component {

    static propTypes = {
        id: PropTypes.string,
        name: PropTypes.string,
        size: PropTypes.number,
        file: PropTypes.object,
        uploaded_at: PropTypes.string,
        user: PropTypes.object,
        onRemove: PropTypes.func
    };

    handleRemove = () => {
        this.props.onRemove(this.props.id);
    };

    render () {

        const { name, size, uploaded_at, user } = this.props;

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
            <ListGroupItem className="spaced">
                <Row>
                    <Col md={5}>
                        <strong>{name}</strong>
                    </Col>
                    <Col md={2}>
                        {byteSize(size)}
                    </Col>
                    <Col md={4}>
                        {creation}
                    </Col>
                    <Col md={1}>
                        <Icon
                            name="remove"
                            bsStyle="danger"
                            style={{fontSize: "17px"}}
                            onClick={this.handleRemove}
                            pullRight
                        />
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}
