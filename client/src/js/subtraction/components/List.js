import React from "react";
import { some } from "lodash";
import { push } from "react-router-redux";
import { connect } from "react-redux";
import { ClipLoader } from "halogenium";
import { LinkContainer } from "react-router-bootstrap";
import { Alert, Col, FormControl, FormGroup, InputGroup, Row } from "react-bootstrap";

import CreateSubtraction from "./Create";
import { findSubtractions } from "../actions";
import { Button, Flex, FlexItem, Icon, ListGroupItem, LoadingPlaceholder, NoneFound, ViewHeader } from "../../base";


class SubtractionList extends React.Component {

    componentDidMount () {
        this.props.onFind(new window.URL(window.location));
    }

    handleChangeTerm = (term) => {
        const url = new window.URL(window.location);

        if (term) {
            url.searchParams.set("find", term);
        } else {
            url.searchParams.delete("find");
        }

        this.props.onFind(url);
    };

    render () {

        if (this.props.documents === null) {
            return <LoadingPlaceholder/>;
        }

        let hostComponents = this.props.documents.map((document) => {

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
            hostComponents = <NoneFound noun="Subtractions" noListGroup />;
        }

        let alert;

        if (!some(this.props.documents, {ready: true})) {
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
                <ViewHeader
                    title="Subtraction"
                    page={this.props.page}
                    count={this.props.documents.length}
                    foundCount={this.props.found_count}
                    totalCount={this.props.total_count}
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
                                onChange={(e) => this.handleChangeTerm(e.target.value)}
                                placeholder="Host name"
                            />
                        </InputGroup>
                    </FormGroup>

                    <LinkContainer to="/subtraction/files">
                        <Button icon="folder-open" tip="Files" />
                    </LinkContainer>

                    {this.props.canModify ? (
                        <LinkContainer to={{state: {createSubtraction: true}}}>
                            <Button bsStyle="primary" icon="new-entry" tip="Create" />
                        </LinkContainer>
                    ) : null}
                </div>

                <div className="list-group">
                    {hostComponents}
                </div>

                <CreateSubtraction
                    show={!!this.props.history.location.state && this.props.history.location.state.createSubtraction}
                    onHide={this.props.onHide}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    ...state.subtraction,
    canModify: state.account.permissions.modify_subtraction
});

const mapDispatchToProps = (dispatch) => ({

    onFind: (url) => {
        dispatch(push(url.pathname + url.search));
        dispatch(findSubtractions());
    },

    onHide: () => {
        dispatch(push({state: {createSubtraction: false}}));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(SubtractionList);

export default Container;
