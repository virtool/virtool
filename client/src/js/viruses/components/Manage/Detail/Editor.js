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
import { connect } from "react-redux";
import { withRouter, Switch, Redirect, Route } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Badge, Row, Col, ListGroup } from "react-bootstrap";

import { formatIsolateName } from "virtool/js/utils";
import { showAddIsolate } from "../../../actions";
import { Flex, FlexItem, Icon, ListGroupItem } from "virtool/js/components/Base";
import IsolateDetail from "./IsolateDetail";

const IsolateEditor = (props) => {

    const activeIsolateId = props.match.params.isolateId;

    const isolateComponents = props.isolates.map(isolate => {
        const isolateId = isolate.isolate_id;

        return (
            <LinkContainer key={isolateId} to={`/viruses/${props.virusId}/virus/${isolateId}`}>
                <ListGroupItem key={isolate.isolate_id} active={isolateId === activeIsolateId}>
                    {formatIsolateName({sourceType: isolate.source_type, sourceName: isolate.source_name})}
                    {isolate.default ? <Icon name="star" pullRight />: null}
                </ListGroupItem>
            </LinkContainer>
        );
    });

    // Get the array of sequences from the isolate.
    // const sequenceData = activeIsolate && activeIsolate.hasOwnProperty("sequences") ? activeIsolate.sequences: [];
    return (
        <div>
            <h4 style={{display: "flex", alignItems: "center", borderBottom: "1px solid #ddd", paddingBottom: "5px", marginBottom: "10px"}}>
                <strong>
                    Isolates
                </strong>

                <FlexItem grow={1}>
                    <Badge style={{marginLeft: "5px", flex: "1 0 auto"}}>
                        {isolateComponents.length}
                    </Badge>
                </FlexItem>

                <Icon bsStyle="primary" name="new-entry" onClick={props.showAddIsolate} />
            </h4>

            <Row>
                <Col md={3}>
                    <ListGroup style={{height: "100%"}} fill>
                        {isolateComponents}
                    </ListGroup>
                </Col>
                <Col md={9}>
                    <Redirect
                        from="/viruses/:virusId/virus"
                        to={`/viruses/${props.virusId}/virus/${props.isolates[0].isolate_id}`}
                    />
                    <Route path="/viruses/:virusId/virus/:isolateId" component={IsolateDetail} />
                </Col>
            </Row>
        </div>
    );
};

const mapStateToProps = (state) => {
    return {
        virusId: state.viruses.detail.virus_id,
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
