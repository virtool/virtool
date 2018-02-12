import React from "react";
import { Helmet } from "react-helmet";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Label, Nav, NavItem } from "react-bootstrap";

import AddIsolate from "./AddIsolate";
import IsolateEditor from "./Editor";
import EditVirus from "./EditVirus";
import General from "./General";
import History from "./History";
import RemoveVirus from "./RemoveVirus";
import Schema from "./Schema";
import { getVirus, showEditVirus, showRemoveVirus } from "../../actions";
import { Flex, FlexItem, Icon, LoadingPlaceholder } from "../../../base";

const VirusSection = ({ match }) => (
    <div>
        <General />
        <IsolateEditor />
        <AddIsolate virusId={match.params.virusId} />
    </div>
);

class VirusDetail extends React.Component {

    componentDidMount () {
        this.props.getVirus(this.props.match.params.virusId);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.virusId) {
            return <LoadingPlaceholder />;
        }

        const virusId = this.props.detail.id;

        const { name, abbreviation } = this.props.detail;

        let iconButtons = [];

        if (this.props.canModify) {
            iconButtons = (
                <span>
                    <small key="edit-icon" style={{paddingLeft: "5px"}}>
                        <Icon
                            bsStyle="warning"
                            name="pencil"

                            onClick={this.props.showEdit}
                        />
                    </small>

                    <small key="remove-icon" style={{paddingLeft: "5px"}}>
                        <Icon
                            bsStyle="danger"
                            name="remove"
                            onClick={this.props.showRemove}
                        />
                    </small>
                </span>
            );
        }

        return (
            <div>
                <Helmet>
                    <title>{name}</title>
                </Helmet>

                <h3 style={{marginBottom: "20px"}}>
                    <Flex alignItems="flex-end">
                        <FlexItem grow={1}>
                            <Flex alignItems="center">
                                <strong>
                                    {name}
                                </strong>
                                <FlexItem grow={1} pad={5}>
                                    <small className="text-strong">
                                        {abbreviation}
                                    </small>
                                </FlexItem>
                            </Flex>
                        </FlexItem>

                        {this.props.detail.modified ? (
                            <small>
                                <Label bsStyle="warning" className="with-icon">
                                    <Icon name="flag" />
                                    Modified
                                </Label>
                            </small>
                        ) : null}

                        {iconButtons}
                    </Flex>
                </h3>

                <Nav bsStyle="tabs">
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

                <EditVirus virusId={virusId} name={name} abbreviation={abbreviation} />
                <RemoveVirus virusId={virusId} virusName={name} history={this.props.history} />

                <Switch>
                    <Redirect from="/viruses/:virusId" to={`/viruses/${virusId}/virus`} exact />
                    <Route path="/viruses/:virusId/virus" component={VirusSection} />
                    <Route path="/viruses/:virusId/history" component={History} />
                    <Route
                        path="/viruses/:virusId/schema"
                        component={() => <Schema detail={this.props.detail} match={this.props.match} />}
                    />
                </Switch>
            </div>
        );
    };
}

const mapStateToProps = state => ({
    detail: state.viruses.detail,
    canModify: state.account.permissions.modify_virus
});

const mapDispatchToProps = dispatch => ({

    getVirus: (virusId) => {
        dispatch(getVirus(virusId));
    },

    showEdit: () => {
        dispatch(showEditVirus());
    },

    showRemove: () => {
        dispatch(showRemoveVirus());
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(VirusDetail);

export default Container;
