/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports SubtractionDetail
 */

import React, { PropTypes } from "react";
import Numeral from "numeral";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col, Badge, Table } from "react-bootstrap";

import { getSubtraction } from "../actions";
import { Button } from "virtool/js/components/Base";

const calculateGC = (nucleotides) => {
    return Numeral(1 - nucleotides.a - nucleotides.t - nucleotides.n).format("0.000")
};

class SubtractionDetail extends React.Component {

    componentDidMount () {
        this.props.onGet(this.props.match.params.subtractionId);
    }

    render () {

        if (this.props.detail === null) {
            return <div />;
        }

        const data = this.props.detail;

        const linkedSampleComponents = data.linked_samples.map(sample =>
            <Col key={sample.id} xs={6} sm={4} md={3} lg={2}>
                <LinkContainer className="linked-sample-button" to={`/samples/${sample.id}`}>
                    <Button block>
                        {sample.name}
                    </Button>
                </LinkContainer>
            </Col>
        );

        return (
            <div>
                <h3 className="view-header">
                    <strong>{data.id}</strong>
                </h3>

                <Table bordered>
                    <tbody>
                        <tr>
                            <th>Description</th>
                            <td>{data.description}</td>
                        </tr>

                        <tr>
                            <th>File</th>
                            <td>{data.file_name}</td>
                        </tr>

                        <tr>
                            <th>GC Estimate</th>
                            <td>{calculateGC(data.nucleotides)}</td>
                        </tr>
                    </tbody>
                </Table>

                <h4 className="section-header">
                    <strong>Linked Samples</strong> <Badge>{linkedSampleComponents.length}</Badge>
                </h4>

                <Row>
                    {linkedSampleComponents}
                </Row>
            </div>
        )
    }
}

SubtractionDetail.propTypes = {
    match: PropTypes.object,
    detail: PropTypes.object,
    onHide: PropTypes.func,
    onGet: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        detail: state.subtraction.detail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onGet: (subtractionId) => {
            dispatch(getSubtraction(subtractionId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SubtractionDetail);

export default Container;
