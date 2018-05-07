import React from "react";
import { Helmet } from "react-helmet";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Label, Nav, NavItem } from "react-bootstrap";

import AddIsolate from "./AddIsolate";
import IsolateEditor from "./Editor";
import EditOTU from "./EditOTU";
import General from "./General";
import History from "./History";
import RemoveOTU from "./RemoveOTU";
import Schema from "./Schema";
import { getOTU, showEditOTU, showRemoveOTU } from "../../actions";
import { Flex, FlexItem, Icon, LoadingPlaceholder } from "../../../base";

const OTUSection = ({ match }) => (
    <div>
        <General />
        <IsolateEditor />
        <AddIsolate OTUId={match.params.OTUId} />
    </div>
);

class OTUDetail extends React.Component {

    componentDidMount () {
        this.props.getOTU(this.props.match.params.OTUId);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.OTUId) {
            return <LoadingPlaceholder />;
        }

        const OTUId = this.props.detail.id;

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
                    <title>{`${name} - OTU`}</title>
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
                    <LinkContainer to={`/OTUs/${OTUId}/OTU`}>
                        <NavItem>
                            OTU
                        </NavItem>
                    </LinkContainer>

                    <LinkContainer to={`/OTUs/${OTUId}/schema`}>
                        <NavItem>
                            Schema
                        </NavItem>
                    </LinkContainer>

                    <LinkContainer to={`/OTUs/${OTUId}/history`}>
                        <NavItem>
                            History
                        </NavItem>
                    </LinkContainer>

                </Nav>

                <EditOTU OTUId={OTUId} name={name} abbreviation={abbreviation} />
                <RemoveOTU OTUId={OTUId} OTUName={name} history={this.props.history} />

                <Switch>
                    <Redirect from="/OTUs/:OTUId" to={`/OTUs/${OTUId}/OTU`} exact />
                    <Route path="/OTUs/:OTUId/OTU" component={OTUSection} />
                    <Route path="/OTUs/:OTUId/history" component={History} />
                    <Route path="/OTUs/:OTUId/schema" component={Schema} />
                </Switch>
            </div>
        );
    };
}

const mapStateToProps = state => ({
    detail: state.OTUs.detail,
    canModify: state.account.permissions.modify_OTU
});

const mapDispatchToProps = dispatch => ({

    getOTU: (OTUId) => {
        dispatch(getOTU(OTUId));
    },

    showEdit: () => {
        dispatch(showEditOTU());
    },

    showRemove: () => {
        dispatch(showRemoveOTU());
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(OTUDetail);
