import CX from "classnames";
import React from "react";
import PropTypes from "prop-types";
import { Row, Col, Label } from "react-bootstrap";
import { Flex, FlexItem } from "../../../../base";
import { toScientificNotation } from "../../../../utils";

export default class PathoscopeEntry extends React.Component {

    static propTypes = {
        id: PropTypes.string,
        name: PropTypes.string,
        abbreviation: PropTypes.string,

        pi: PropTypes.number,
        best: PropTypes.number,
        reads: PropTypes.number,
        coverage: PropTypes.number,

        in: PropTypes.bool,
        toggleIn: PropTypes.func,
        showReads: PropTypes.bool
    };

    shouldComponentUpdate (nextProps) {
        return this.props.in !== nextProps.in || this.props.showReads !== nextProps.showReads;
    }

    toggleIn = () => this.props.toggleIn(this.props.id);

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
                    <Col xs={12} md={6}>
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

                    <Col xs={12} mdHidden lgHidden>
                        <div style={{height: "20px"}} />
                    </Col>

                    <Col xs={6} sm={4} md={2}>
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
                    <Col xs={6} sm={4} md={2}>
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
                    <Col xs={6} sm={4} md={2}>
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
