import React from "react";
import { map } from "lodash-es";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Col, FormControl, FormGroup, InputGroup, Row } from "react-bootstrap";

import CreateSubtraction from "./Create";
import { Button, Flex, FlexItem, Icon, ListGroupItem, LoadingPlaceholder, NoneFound, ViewHeader } from "../../base";
import {createFindURL, getFindTerm} from "../../utils";

const SubtractionList = (props) => {

    if (props.documents === null) {
        return <LoadingPlaceholder />;
    }

    let hostComponents = map(props.documents, document => {

        let icon;

        if (document.ready) {
            icon = <Icon name="checkmark" bsStyle="success" />;
        } else {
            icon = <ClipLoader size="14px" color="#3c8786" />;
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
                            <Flex alignItems="center" className="pull-right">
                                {icon}
                                <FlexItem pad>
                                    <strong>{document.ready ? "Ready" : "Importing"}</strong>
                                </FlexItem>
                            </Flex>
                        </Col>
                    </Row>
                </ListGroupItem>
            </LinkContainer>
        );
    });

    if (!hostComponents.length) {
        hostComponents = <NoneFound noun="subtractions" noListGroup />;
    }

    let alert;

    if (!props.ready_host_count) {
        alert = (
            <Alert bsStyle="warning">
                <Flex alignItems="center">
                    <Icon name="notification" />
                    <FlexItem pad={5}>
                        <strong>
                            A host genome must be added before samples can be created and analyzed.
                        </strong>
                    </FlexItem>
                </Flex>
            </Alert>
        );
    }

    return (
        <div>
            <ViewHeader
                title="Subtraction"
                page={props.page}
                count={props.documents.length}
                foundCount={props.found_count}
                totalCount={props.total_count}
            />

            {alert}

            <div key="toolbar" className="toolbar">
                <FormGroup>
                    <InputGroup>
                        <InputGroup.Addon>
                            <Icon name="search" />
                        </InputGroup.Addon>
                        <FormControl
                            type="text"
                            value={props.term}
                            onChange={props.onFind}
                            placeholder="Host name"
                        />
                    </InputGroup>
                </FormGroup>

                <LinkContainer to="/subtraction/files">
                    <Button icon="folder-open" tip="Files" />
                </LinkContainer>

                {props.canModify ? (
                    <LinkContainer to={{state: {createSubtraction: true}}}>
                        <Button bsStyle="primary" icon="new-entry" tip="Create" />
                    </LinkContainer>
                ) : null}
            </div>

            <div className="list-group">
                {hostComponents}
            </div>

            <CreateSubtraction />
        </div>
    );
};

const mapStateToProps = (state) => ({
    ...state.subtraction,
    term: getFindTerm(),
    canModify: state.account.permissions.modify_subtraction
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (e) => {
        const url = createFindURL({find: e.target.value});
        dispatch(push(url.pathname + url.search));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(SubtractionList);
