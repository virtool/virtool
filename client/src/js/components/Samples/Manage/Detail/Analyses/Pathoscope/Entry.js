import CX from "classnames";
import React from "react";
import { Row, Col, Label } from "react-bootstrap";
import { Flex, FlexItem } from "virtool/js/components/Base";
import { toScientificNotation } from "virtool/js/utils";

export default class PathoscopeEntry extends React.Component {

    static propTypes = {
        _id: React.PropTypes.string,
        name: React.PropTypes.string,
        abbreviation: React.PropTypes.string,

        pi: React.PropTypes.number,
        best: React.PropTypes.number,
        reads: React.PropTypes.number,
        coverage: React.PropTypes.number,

        in: React.PropTypes.bool,
        toggleIn: React.PropTypes.func,
        showReads: React.PropTypes.bool
    };

    shouldComponentUpdate (nextProps) {
        return this.props.in !== nextProps.in || this.props.showReads !== nextProps.showReads;
    }

    toggleIn = () => this.props.toggleIn(this.props._id);

    render () {

        const className = CX("list-group-item", "spaced", {"hoverable": !this.props.in});

        let closeButton;

        if (this.props.in) {
            closeButton = (
                <button type="button" className="close" onClick={this.toggleIn}>
                    <span>×</span>
                </button>
            );
        }

        const flexStyle = {height: "21px"};

        const piValue = this.props.showReads ? this.props.reads: toScientificNotation(this.props.pi);

        return (
            <div className={className} onClick={this.props.in ? null: this.toggleIn}>
                <Row>
                    <Col md={6}>
                        <Flex>
                            <FlexItem>
                                {this.props.name}
                            </FlexItem>
                            <FlexItem pad={5}>
                                <small className="text-primary">
                                    <strong className="text-warning">
                                        {this.props.abbreviation}
                                    </strong>
                                </small>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center" style={flexStyle}>
                            <FlexItem>
                                <Label>{this.props.showReads ? "Reads": "Weight"}</Label>
                            </FlexItem>
                            <FlexItem pad={5}>
                                <strong className="text-success">
                                    {piValue}
                                </strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center" alignContent="center" style={flexStyle}>
                            <FlexItem>
                                <Label>Best Hit</Label>
                            </FlexItem>
                            <FlexItem pad={5}>
                                <strong className="text-danger">
                                    {toScientificNotation(this.props.best)}
                                </strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={2}>
                        <Flex alignItems="center" style={flexStyle}>
                            <FlexItem>
                                <Label>Coverage</Label>
                            </FlexItem>
                            <FlexItem grow={1} pad={5}>
                                <strong className="text-primary">
                                    {toScientificNotation(this.props.coverage)}
                                </strong>
                            </FlexItem>
                            <FlexItem>
                                {closeButton}
                            </FlexItem>
                        </Flex>
                    </Col>
                </Row>
            </div>
        );
    }
}
