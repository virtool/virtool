import React from "react";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { LinkContainer } from "react-router-bootstrap";
import { Nav, NavItem } from "react-bootstrap";
import { getReference } from "../../actions";
import { LoadingPlaceholder } from "../../../base";

import ReferenceManage from "./Manage";
import ReferenceOTU from "./OTU";
import ReferenceIndex from "./Index";

const ReferenceSettings = () => (
    <div>Settings</div>
);

class ReferenceDetail extends React.Component {

    componentDidMount () {
        this.props.getReference(this.props.match.params.refId);
    }

    render = () => {

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.refId) {
            return <LoadingPlaceholder />;
        }

        const { name, id } = this.props.detail;

        return (
            <div>
                <h3 className="view-header">
                    <strong>{name}</strong>
                </h3>
                <Nav bsStyle="tabs">
                    <LinkContainer to={`/refs/${id}/manage`}>
                        <NavItem>Manage</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${id}/otu`}>
                        <NavItem>OTU</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${id}/indexes`}>
                        <NavItem>Indexes</NavItem>
                    </LinkContainer>
                    <LinkContainer to={`/refs/${id}/settings`}>
                        <NavItem>Settings</NavItem>
                    </LinkContainer>
                </Nav>

                <Switch>
                    <Redirect from="/refs/:refId" to={`/refs/${id}/manage`} exact />
                    <Route path="/refs/:refId/manage" component={ReferenceManage} />
                    <Route path="/refs/:refId/otu" component={ReferenceOTU} />
                    <Route path="/refs/:refId/indexes" component={ReferenceIndex} />
                    <Route path="/refs/:refId/settings" component={ReferenceSettings} />
                </Switch>
            </div>
        );
    };
}

const mapStateToProps = state => ({
    detail: state.references.detail
});

const mapDispatchToProps = dispatch => ({

    getReference: (refId) => {
        dispatch(getReference(refId));
    }

});

export default connect(mapStateToProps, mapDispatchToProps)(ReferenceDetail)
