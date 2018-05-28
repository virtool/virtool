import React from "react";
import { Helmet } from "react-helmet";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Label, Nav, NavItem, Breadcrumb } from "react-bootstrap";

import AddIsolate from "./AddIsolate";
import IsolateEditor from "./Editor";
import EditOTU from "./EditOTU";
import General from "./General";
import History from "./History";
import RemoveOTU from "./RemoveOTU";
import Schema from "./Schema";
import { getReference } from "../../../references/actions";
import { getOTU, showEditOTU, showRemoveOTU } from "../../actions";
import { Flex, FlexItem, Icon, LoadingPlaceholder } from "../../../base";

const OTUSection = ({ match }) => (
    <div>
        <General />
        <IsolateEditor />
        <AddIsolate otuId={match.params.otuId} />
    </div>
);

class OTUDetail extends React.Component {

    componentDidMount () {
        this.props.getOTU(this.props.match.params.otuId);
    }

    componentDidUpdate (prevProps) {
        if (this.props.detail !== null && prevProps.detail !== this.props.detail) {
            this.props.onGetReference(this.props.detail.reference.id);
        }
    }

    render = () => {

        if (this.props.detail === null ||
            this.props.detail.id !== this.props.match.params.otuId ||
            this.props.refDetail === null
        ) {
            return <LoadingPlaceholder />;
        }

        const otuId = this.props.detail.id;
        const refId = this.props.detail.reference.id;

        const { name, abbreviation } = this.props.detail;

        let iconButtons = [];

        if (this.props.canModify) {
            iconButtons = (
                <span>
                    <small key="edit-icon" style={{paddingLeft: "5px"}}>
                        <Icon
                            bsStyle="warning"
                            name="pencil-alt"
                            tip="Edit OTU"
                            tipPlacement="left"
                            onClick={this.props.showEdit}
                        />
                    </small>

                    <small key="remove-icon" style={{paddingLeft: "5px"}}>
                        <Icon
                            bsStyle="danger"
                            name="trash"
                            tip="Remove OTU"
                            tipPlacement="left"
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

                <Breadcrumb>
                    <Breadcrumb.Item>
                        <LinkContainer to={`/refs/${refId}/otus`}>
                            <div>
                                OTUs
                            </div>
                        </LinkContainer>
                    </Breadcrumb.Item>
                    <Breadcrumb.Item active>{this.props.detail.name}</Breadcrumb.Item>
                </Breadcrumb>

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
                    <LinkContainer to={`/refs/${refId}/otus/${otuId}/otu`}>
                        <NavItem>
                            OTU
                        </NavItem>
                    </LinkContainer>

                    <LinkContainer to={`/refs/${refId}/otus/${otuId}/schema`}>
                        <NavItem>
                            Schema
                        </NavItem>
                    </LinkContainer>

                    <LinkContainer to={`/refs/${refId}/otus/${otuId}/history`}>
                        <NavItem>
                            History
                        </NavItem>
                    </LinkContainer>

                </Nav>

                <EditOTU otuId={otuId} name={name} abbreviation={abbreviation} />
                <RemoveOTU otuId={otuId} otuName={name} history={this.props.history} />

                <Switch>
                    <Redirect from="/refs/:refId/otus/:otuId" to={`/refs/${refId}/otus/${otuId}/otu`} exact />
                    <Route path="/refs/:refId/otus/:otuId/otu" component={OTUSection} />
                    <Route path="/refs/:refId/otus/:otuId/history" component={History} />
                    <Route path="/refs/:refId/otus/:otuId/schema" component={Schema} />
                </Switch>
            </div>
        );
    };
}

const mapStateToProps = state => ({
    detail: state.otus.detail,
    canModify: state.account.administrator,
    refDetail: state.otus.detail
});

const mapDispatchToProps = dispatch => ({

    getOTU: (otuId) => {
        dispatch(getOTU(otuId));
    },

    showEdit: () => {
        dispatch(showEditOTU());
    },

    showRemove: () => {
        dispatch(showRemoveOTU());
    },

    onGetReference: (refId) => {
        dispatch(getReference(refId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(OTUDetail);
