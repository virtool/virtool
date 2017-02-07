import React from "react";
import Numeral from "numeral";
import { Row, Col } from "react-bootstrap";
import { Icon, ListGroupItem } from "virtool/js/components/Base";

export default class ReadItem extends React.PureComponent {

    static propTypes = {
        _id: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        size_end: React.PropTypes.number.isRequired,
        onSelect: React.PropTypes.func.isRequired,
        selected: React.PropTypes.bool
    };

    static defaultProps = {
        selected: false
    };

    render = () => (
        <ListGroupItem onClick={() => this.props.onSelect(this.props._id)} active={this.props.selected}>
            <Row>
                <Col md={8}>
                    <Icon name="file" /> {this.props.name}
                </Col>
                <Col md={4}>
                    {Numeral(this.props.size_end).format(" 0.0 b")}
                </Col>
            </Row>
        </ListGroupItem>
    );
}
