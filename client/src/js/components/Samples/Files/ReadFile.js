import React from "react";
import Numeral from "numeral";
import {Row, Col, ProgressBar, ListGroupItem} from "react-bootstrap";
import Icon from "virtool/js/components/Base/Icon";
import RelativeTime from "virtool/js/components/Base/RelativeTime";


export default class ReadFile extends React.Component {

    static propTypes = {
        _id: React.PropTypes.string.isRequired,
        name: React.PropTypes.string.isRequired,
        size_now: React.PropTypes.number.isRequired,
        size_end: React.PropTypes.number.isRequired
    }

    shouldComponentUpdate () {
        return !this.props.ready || this.props.size_now != this.props.size_end;
    }

    remove = () => {
        dispatcher.db.files.request("remove_file", {
            "file_id": this.props._id
        });
    }

    render () {
        return (
            <ListGroupItem className="spaced">
                <ProgressBar
                    className="progress-small"
                    bsStyle={this.props.ready ? null: "success"}
                    now={this.props.created ? this.props.size_now / this.props.size_end * 100: 0}
                />
                <Row>
                    <Col md={5}>
                        <Icon name="file" /> {this.props.name}
                    </Col>
                    <Col md={3}>
                        Added <RelativeTime time={this.props.timestamp} />
                    </Col>
                    <Col md={2}>
                        <span className="pull-right">
                            {Numeral(this.props.size_now).format("0.0 b")}
                        </span>
                    </Col>
                    <Col md={2}>
                        <Icon className="pull-right" name="remove" bsStyle="danger" onClick={this.remove} />
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }

}