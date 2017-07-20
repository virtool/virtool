/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports ManageHosts
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col, Alert, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { findSubtractions } from "../actions";
import { Flex, FlexItem, Icon, Button, ListGroupItem } from "virtool/js/components/Base";

class SubtractionList extends React.Component {

    static propTypes = {
        documents: PropTypes.arrayOf(PropTypes.object),
        readyHostCount: PropTypes.number,
        onFind: PropTypes.func
    };

    componentDidMount () {
        this.props.onFind()
    }

    render () {

        if (this.props.documents === null) {
            return <div />;
        }

        let alert;

        if (!this.props.readyHostCount) {
            alert = (
                <Alert bsStyle="warning">
                    <Flex alignItems="center">
                        <Icon name="notification" />
                        <FlexItem pad={5}>
                            A host genome must be added to Virtool before samples can be created and analyzed.
                        </FlexItem>
                    </Flex>
                </Alert>
            );
        }

        let hostComponents = this.props.documents.map((document) => {

            let statusComponent = "Adding";

            if (document.ready) {
                statusComponent = (
                    <Flex alignItems="center" className="pull-right">
                        <Icon name="checkmark" bsStyle="success" />
                        <FlexItem pad>
                            <strong>Ready</strong>
                        </FlexItem>
                    </Flex>
                )
            }

            return (
                <LinkContainer key={document.subtraction_id} to={`/subtraction/${document.subtraction_id}`}>
                    <ListGroupItem className="spaced">
                        <Row>
                            <Col md={4}>
                                <strong>{document.subtraction_id}</strong>
                            </Col>
                            <Col md={3} className="text-muted">
                                {document.description}
                            </Col>
                            <Col md={5}>
                                {statusComponent}
                            </Col>
                        </Row>
                    </ListGroupItem>
                </LinkContainer>
            );
        });

        if (!hostComponents.length) {
            hostComponents = (
                <ListGroupItem key="noSample" className="text-center">
                    <Icon name="info" /> No hosts found
                </ListGroupItem>
            );
        }

        return (
            <div>
                <h3 className="view-header">
                    <strong>Subtraction</strong>
                </h3>

                {alert}

                <div key="toolbar" className="toolbar">
                    <FormGroup>
                        <InputGroup>
                            <InputGroup.Addon>
                                <Icon name="search" />
                            </InputGroup.Addon>
                            <FormControl
                                type="text"
                                onChange={(event) => console.log(event.target.value)}
                                placeholder="Host name"
                            />
                        </InputGroup>
                    </FormGroup>

                    <LinkContainer to="/subtraction/create">
                        <Button icon="new-entry" bsStyle="primary" />
                    </LinkContainer>
                </div>

                <div className="list-group">
                    {hostComponents}
                </div>
            </div>
        );
    }
}

const mapStateToProps = (state) => {
    return {
        documents: state.subtraction.documents,
        readyHostCount: state.subtraction.readyHostCount
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: () => {
            dispatch(findSubtractions())
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SubtractionList);

export default Container;
