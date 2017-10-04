import React from "react";
import CX from "classnames";
import PropTypes from "prop-types";
import { Row, Col, Label } from "react-bootstrap";
import { Flex, FlexItem } from "../../../../base";

export default class NuVsEntry extends React.Component {
    
    static propTypes = {
        in: PropTypes.bool,
        index: PropTypes.number,
        sequence: PropTypes.string,
        orfs: PropTypes.array,
        minE: PropTypes.number,
        toggleIn: PropTypes.func
    };

    shouldComponentUpdate (nextProps) {
        return nextProps.in !== this.props.in;
    }

    render () {

        const flexStyle = {
            height: "21px"
        };

        const className = CX("list-group-item", "spaced", {"hoverable": !this.props.in});

        let closeButton;

        if (this.props.in) {
            closeButton = (
                <FlexItem grow={0} shrink={0}>
                    <button type="button" className="close" onClick={() => this.props.toggleIn(this.props.index)}>
                        <span>×</span>
                    </button>
                </FlexItem>
            );
        }

        return (
            <div className={className} onClick={() => {if (!this.props.in) this.props.toggleIn(this.props.index)}}>
                <Row>
                    <Col md={3}>
                        <strong>Sequence {this.props.index}</strong>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center" style={flexStyle}>
                            <FlexItem>
                                <Label>Length</Label>
                            </FlexItem>
                            <FlexItem pad={5}>
                                <strong className="text-primary">
                                    {this.props.sequence.length}
                                </strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex alignItems="center" style={flexStyle}>
                            <FlexItem>
                                <Label>E-value</Label>
                            </FlexItem>
                            <FlexItem pad={5}>
                                <strong className="text-danger">
                                    {this.props.minE}
                                </strong>
                            </FlexItem>
                        </Flex>
                    </Col>
                    <Col md={3}>
                        <Flex>
                            <FlexItem grow={1} shrink={0}>
                                <Flex alignItems="center" style={flexStyle}>
                                    <FlexItem>
                                        <Label>ORFs</Label>
                                    </FlexItem>
                                    <FlexItem pad={5}>
                                        <strong className="text-success">
                                            {this.props.orfs.length}
                                        </strong>
                                    </FlexItem>
                                </Flex>
                            </FlexItem>
                            {closeButton}
                        </Flex>
                    </Col>
                </Row>
            </div>
        );
    }
}
