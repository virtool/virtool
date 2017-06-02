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
import { Modal, Nav, NavItem, Panel } from "react-bootstrap";

import { getVirus } from "../../actions";
import { Spinner } from "virtool/js/components/Base";
// import Isolates from "./Detail/Isolates";
// import General from "./Detail/General";

class VirusDetail extends React.Component {

    static propTypes = {
        match: PropTypes.object,
        history: PropTypes.object,
        detail: PropTypes.object,
        getVirus: PropTypes.func
    };

    modalEnter = () => {
        this.props.getVirus(this.props.match.params.virusId);
    };

    hide = () => {
        this.props.history.push("/viruses")
    };

    render = () => {

        let content;

        if (this.props.detail) {

            const virusId = this.props.match.params.virusId;

            content = (
                <div>
                    <Nav bsStyle="tabs">
                        <LinkContainer to={`/viruses/detail/${virusId}/virus`}>
                            <NavItem>
                                Virus
                            </NavItem>
                        </LinkContainer>

                        <LinkContainer to={`/viruses/detail/${virusId}/history`}>
                            <NavItem>
                                History
                            </NavItem>
                        </LinkContainer>
                    </Nav>

                    <Panel className="tab-panel">
                        <Switch>
                            <Redirect from="/viruses/detail/:virusId" to={`/viruses/detail/${virusId}/virus`} exact />
                            <Route path="/viruses/detail/:virusId/virus" render={() => <div>Virus</div>} />
                            <Route path="/viruses/detail/:virusId/history" render={() => <div>History</div>} />
                        </Switch>
                    </Panel>
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
            <Modal bsSize="lg" show={true} onEnter={this.modalEnter} onHide={this.hide}>
                <Modal.Header onHide={this.hide} closeButton>
                    Virus Detail
                </Modal.Header>
                <Modal.Body>
                    {content}
                </Modal.Body>
            </Modal>
        );
    };
}

const mapStateToProps = (state) => {
    return {
        thing: "test",
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
