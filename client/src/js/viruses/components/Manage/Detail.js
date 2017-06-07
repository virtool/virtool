/**
 * @license
 * The MIT License (MIT)
 * Copyright 2015 Government of Canada
 *
 * @author
 * Ian Boyes
 *
 * @exports VirusDetail
 */

import React, { PropTypes } from "react";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Nav, NavItem, Panel } from "react-bootstrap";

import { getVirus } from "../../actions";
import { Flex, FlexItem, Spinner, Button } from "virtool/js/components/Base";
import IsolateEditor from "./Detail/Editor";
import General from "./Detail/General";

const VirusSection = () => (
    <div>
        <General />
        <IsolateEditor />
    </div>
);

class VirusDetail extends React.Component {

    static propTypes = {
        match: PropTypes.object,
        history: PropTypes.object,
        detail: PropTypes.object,
        getVirus: PropTypes.func
    };

    componentDidMount () {
        this.props.getVirus(this.props.match.params.virusId)
    }

    render = () => {

        let content;

        if (this.props.detail) {

            const virusId = this.props.match.params.virusId;

            content = (
                <div>
                    <h4 style={{marginBottom: "20px"}}>
                        <Flex alignItems="flex-end">
                            <FlexItem grow={1}>
                                <Flex alignItems="center">
                                    <strong>
                                        {this.props.detail.name}
                                    </strong>
                                    <FlexItem grow={1} pad={5}>
                                        <small className="text-uppercase text-strong">
                                            {this.props.detail.abbreviation}
                                        </small>
                                    </FlexItem>
                                </Flex>
                            </FlexItem>

                            <FlexItem pad={5}>
                                <Button bsStyle="primary" bsSize="small" icon="new-entry">
                                    Add Isolate
                                </Button>
                            </FlexItem>

                            <FlexItem pad={5}>
                                <Button bsStyle="danger" bsSize="small" icon="remove">
                                    Remove
                                </Button>
                            </FlexItem>
                        </Flex>
                    </h4>

                    <Flex>
                        <FlexItem>
                            <Nav bsStyle="pills" stacked>
                                <LinkContainer to={`/viruses/${virusId}/virus`}>
                                    <NavItem>
                                        Virus
                                    </NavItem>
                                </LinkContainer>

                                <LinkContainer to={`/viruses/${virusId}/history`}>
                                    <NavItem>
                                        History
                                    </NavItem>
                                </LinkContainer>
                            </Nav>
                        </FlexItem>

                        <FlexItem grow={1} pad={16}>
                            <Switch>
                                <Redirect from="/viruses/:virusId" to={`/viruses/${virusId}/virus`} exact />
                                <Route path="/viruses/:virusId/virus" component={VirusSection} />
                                <Route path="/viruses/:virusId/history" render={() => <div>History</div>} />
                            </Switch>
                        </FlexItem>
                    </Flex>
                </div>
            );
        } else {
            content = (
                <div className="text-center">
                    <Spinner />
                </div>
            );
        }

        return (
            <div>
                {content}
            </div>
        );
    };
}

const mapStateToProps = (state) => {
    return {
        detail: state.viruses.detail
    };
};

const mapDispatchToProps = (dispatch) => {
    return {
        getVirus: (virusId) => {
            dispatch(getVirus(virusId));
        }
    };
};

const Container = connect(mapStateToProps, mapDispatchToProps)(VirusDetail);

export default Container;
