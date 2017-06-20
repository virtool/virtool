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
import { Nav, NavItem } from "react-bootstrap";

import { getVirus } from "../../actions";
import { Flex, FlexItem, Icon, Spinner } from "virtool/js/components/Base";
import IsolateEditor from "./Editor";
import General from "./General";
import AddIsolate from "./AddIsolate";
import History from "./History";

const VirusSection = (props) => (
    <div>
        <General />
        <IsolateEditor />
        <AddIsolate virusId={props.match.params.virusId} />
    </div>
);

VirusSection.propTypes = {
    match: PropTypes.object
};

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
                    <h3 style={{marginBottom: "20px"}}>
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

                            <Icon
                                bsStyle="danger"
                                name="remove"
                                style={{fontSize: "18px"}}
                                onClick={() => window.console.log(this.props.detail.name)}
                            />
                        </Flex>
                    </h3>

                    <Flex>
                        <FlexItem>
                            <Nav bsStyle="pills" stacked>
                                <LinkContainer to={`/viruses/${virusId}/virus`}>
                                    <NavItem>
                                        Virus
                                    </NavItem>
                                </LinkContainer>

                                <LinkContainer to={`/viruses/${virusId}/schema`}>
                                    <NavItem>
                                        Schema
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
                                <Route path="/viruses/:virusId/schema" render={() => <div>Schema</div>} />
                                <Route path="/viruses/:virusId/history" component={History} />
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
