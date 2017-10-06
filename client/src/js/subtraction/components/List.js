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

import React from "react";
import PropTypes from "prop-types";
import { some } from "lodash";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Row, Col, Alert, FormGroup, InputGroup, FormControl } from "react-bootstrap";

import { findSubtractions, showCreateSubtraction } from "../actions";
import { Flex, FlexItem, Icon, Button, ListGroupItem } from "../../base";

class SubtractionList extends React.Component {

    static propTypes = {
        documents: PropTypes.arrayOf(PropTypes.object),
        readyHostCount: PropTypes.number,
        onFind: PropTypes.func,
        onShowCreate: PropTypes.func
    };

    componentDidMount () {
        this.props.onFind()
    }

    render () {

        if (this.props.documents === null) {
            return <div />;
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
                <LinkContainer key={document.id} className="spaced" to={`/subtraction/${document.id}`}>
                    <ListGroupItem>
                        <Row>
                            <Col xs={8} md={4}>
                                <strong>{document.id}</strong>
                            </Col>
                            <Col xsHidden smHidden md={3} className="text-muted">
                                {document.description}
                            </Col>
                            <Col xs={4} md={5}>
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
                    <Icon name="info" /> No hosts found.
                    <span> <Link to={{state: {createSubtraction: true}}}>Create one</Link>.</span>
                </ListGroupItem>
            );
        }

        let alert;

        if (!some(this.props.documents, {"ready": true})) {
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
                                onChange={(event) => window.console.log(event.target.value)}
                                placeholder="Host name"
                            />
                        </InputGroup>
                    </FormGroup>

                    <LinkContainer to="/subtraction/files">
                        <Button icon="folder-open" tip="Files" />
                    </LinkContainer>

                    <LinkContainer to={{state: {createSubtraction: true}}}>
                        <Button bsStyle="primary" icon="new-entry" tip="Create" />
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
        documents: state.subtraction.documents
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        onFind: () => {
            dispatch(findSubtractions())
        },

        onShowCreate: () => {
            dispatch(showCreateSubtraction())
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(SubtractionList);

export default Container;
