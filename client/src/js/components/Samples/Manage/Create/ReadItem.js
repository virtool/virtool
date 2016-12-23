import React from "react";
import Numeral from "numeral";
import {Row, Col} from "react-bootstrap";
import Icon from "virtool/js/components/Base/Icon";
import ListGroupItem from "virtool/js/components/Base/PushListGroupItem";

export default class ReadItem extends React.Component {

    constructor (props) {
        super(props);
    }

    static defaultProps = {
        selected: false
    }

    static propTypes = {
        _id: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        size_end: React.PropTypes.number.isRequired,
        onSelect: React.PropTypes.func.isRequired,
        selected: React.PropTypes.bool
    }

    shouldComponentUpdate (nextProps) {
        return nextProps.selected != this.props.selected;
    }

    handleSelect = () => {
        this.props.onSelect(this.props._id);
    }

    render () {
        return (
            <ListGroupItem onClick={this.handleSelect} active={this.props.selected}>
                <Row>
                    <Col md={8}>
                        <Icon name='file' /> {this.props.name}
                    </Col>
                    <Col md={4}>
                        {Numeral(this.props.size_end).format(' 0.0 b')}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }

}