import React from "react";
import PropTypes from "prop-types";
import { Row, Col } from "react-bootstrap";

import { byteSize } from "virtool/js/utils";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

export default class ReadItem extends React.PureComponent {

    static propTypes = {
        id: PropTypes.string.isRequired,
        name: PropTypes.string.isRequired,
        size: PropTypes.number.isRequired,
        onSelect: PropTypes.func.isRequired,
        selected: PropTypes.bool
    };

    static defaultProps = {
        selected: false
    };

    render = () => (
        <ListGroupItem onClick={() => this.props.onSelect(this.props.id)} active={this.props.selected}>
            <Row>
                <Col md={8}>
                    <Icon name="file" /> {this.props.name}
                </Col>
                <Col md={4}>
                    {byteSize(this.props.size)}
                </Col>
            </Row>
        </ListGroupItem>
    );
}
