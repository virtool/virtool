/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * exports Isolates
 */

import React from "react";
import PropTypes from "prop-types";
import { connect } from "react-redux";
import { withRouter, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Row, Col, ListGroup } from "react-bootstrap";

import { formatIsolateName } from "virtool/js/utils";
import { showAddIsolate } from "../../actions";
import { Flex, FlexItem, Icon, ListGroupItem } from "virtool/js/components/Base";
import IsolateDetail from "./IsolateDetail";

const IsolateEditor = (props) => {

    const activeIsolateId = props.match.params.isolateId;

    const isolateComponents = props.isolates.map(isolate =>
        <LinkContainer key={isolate.id} to={`/viruses/${props.virusId}/virus/${isolate.id}`}>
            <ListGroupItem key={isolate.id} active={isolate.id === activeIsolateId}>
                <Flex alignItems="center">
                    <FlexItem grow={1} shrink={0}>{formatIsolateName(isolate)}</FlexItem>
                    {isolate.default ? <Icon name="star" />: null}
                </Flex>
            </ListGroupItem>
        </LinkContainer>
    );

    let noIsolatesFound;

    if (!isolateComponents.length) {
        noIsolatesFound = (
            <Col md={12}>
                <ListGroupItem className="text-center">
                    <Icon name="info" /> No isolates found
                </ListGroupItem>
            </Col>
        );
    }

    // Get the array of sequences from the isolate.
    // const sequenceData = activeIsolate && activeIsolate.hasOwnProperty("sequences") ? activeIsolate.sequences: [];
    return (
        <div>
            <h4 style={{display: "flex", alignItems: "center"}} className="section-header">
                <FlexItem grow={0} shrink={0}>
                    <strong>
                        Isolates
                    </strong>
                </FlexItem>

                <FlexItem grow={1} pad={5}>
                    <Badge>
                        {isolateComponents.length}
                    </Badge>
                </FlexItem>

                <Icon
                    bsStyle="primary"
                    name="new-entry"
                    tip="Add Isolate"
                    style={{fontSize: "15px"}}
                    onClick={props.showAddIsolate}
                />
            </h4>

            <Row>
                {noIsolatesFound}
                <Col md={3}>
                    <ListGroup style={{height: "100%"}} fill>
                        {isolateComponents}
                    </ListGroup>
                </Col>
                <Col md={9}>
                    <Route path="/viruses/:virusId/virus/:isolateId" component={IsolateDetail} />
                </Col>
            </Row>
        </div>
    );
};

IsolateEditor.propTypes = {
    match: PropTypes.object,
    virusId: PropTypes.string,
    isolates: PropTypes.arrayOf(PropTypes.object),
    showAddIsolate: PropTypes.func
};

const mapStateToProps = (state) => {
    return {
        virusId: state.viruses.detail.id,
        isolates: state.viruses.detail.isolates
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        showAddIsolate: () => {
            dispatch(showAddIsolate());
        }
    };
};

const Container = withRouter(connect(mapStateToProps, mapDispatchToProps)(IsolateEditor));

export default Container;
