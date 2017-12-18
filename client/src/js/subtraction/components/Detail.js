import React from "react";
import Numeral from "numeral";
import { connect } from "react-redux";
import { push } from "react-router-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Col, Row, Table } from "react-bootstrap";

import { getSubtraction } from "../actions";
import { Button, Flex, FlexItem, Icon, LoadingPlaceholder, NoneFound } from "../../base";
import RemoveSubtraction from "./Remove";

const calculateGC = (nucleotides) => Numeral(1 - nucleotides.a - nucleotides.t - nucleotides.n).format("0.000");

class SubtractionDetail extends React.Component {

    componentDidMount () {
        this.props.onGet(this.props.match.params.subtractionId);
    }

    render () {

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        const data = this.props.detail;

        if (data.ready) {
            let linkedSamples;

            if (data.linked_samples.length) {
                const linkedSampleComponents = data.linked_samples.map(sample =>
                    <Col key={sample.id} className="linked-sample-button" xs={6} sm={4} md={3} lg={2}>
                        <LinkContainer to={`/samples/${sample.id}`}>
                            <Button block>
                                {sample.name}
                            </Button>
                        </LinkContainer>
                    </Col>
                );

                linkedSamples = (
                    <Row>
                        {linkedSampleComponents}
                    </Row>
                );
            } else {
                linkedSamples = <NoneFound noun="linked samples" />;
            }

            return (
                <div>
                    <h3 className="view-header">
                        <Flex alignItems="flex-end">
                            <FlexItem grow={0} shrink={0}>
                                <strong>{data.id}</strong>
                            </FlexItem>
                            {this.props.canModify ? (
                                <FlexItem grow={1} shrink={0}>
                                    <small>
                                        <Icon
                                            name="remove"
                                            bsStyle="danger"
                                            onClick={this.props.onShowRemove}
                                            pullRight
                                        />
                                    </small>
                                </FlexItem>
                            ) : null}
                        </Flex>
                    </h3>

                    <Table bordered>
                        <tbody>
                            <tr>
                                <th>File</th>
                                <td>{data.file.id}</td>
                            </tr>

                            <tr>
                                <th>GC Estimate</th>
                                <td>{calculateGC(data.gc)}</td>
                            </tr>
                        </tbody>
                    </Table>

                    <h4 className="section-header">
                        <strong>Linked Samples</strong> <Badge>{data.linked_samples.length}</Badge>
                    </h4>

                    {linkedSamples}

                    <RemoveSubtraction id={data.id} />
                </div>
            );
        }

        return <LoadingPlaceholder message="Subtraction is still being imported" />;
    }
}

const mapStateToProps = (state) => ({
    canModify: state.account.permissions.modify_subtraction,
    detail: state.subtraction.detail
});

const mapDispatchToProps = (dispatch) => ({

    onGet: (subtractionId) => {
        dispatch(getSubtraction(subtractionId));
    },

    onShowRemove: () => {
        dispatch(push({state: {removeSubtraction: true}}));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(SubtractionDetail);

export default Container;
