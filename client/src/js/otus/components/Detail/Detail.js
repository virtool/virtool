import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Redirect, Route, Switch } from "react-router-dom";
import styled from "styled-components";
import { Icon, LoadingPlaceholder, NotFound, TabLink, Tabs, ViewHeader } from "../../../base";
import { Breadcrumb, BreadcrumbItem } from "../../../base/Breadcrumb";
import { checkRefRight } from "../../../utils/utils";
import { getOTU, showEditOTU, showRemoveOTU } from "../../actions";
import AddIsolate from "./AddIsolate";
import IsolateEditor from "./Editor";
import EditOTU from "./EditOTU";
import General from "./General";
import History from "./History";
import RemoveOTU from "./RemoveOTU";
import Schema from "./Schema";

const OTUSection = () => (
    <div>
        <General />
        <IsolateEditor />
        <AddIsolate />
    </div>
);

const OTUDetailHeader = styled.h1`
    align-items: baseline;
    display: flex;
    margin-bottom: 20px;
    font-size: 24px;
    font-weight: bold;

    small {
        font-weight: bold;
        padding-left: 7px;

        em {
            font-weight: normal;
        }
    }

    span:last-child {
        margin-left: auto;
    }
`;

class OTUDetail extends React.Component {
    componentDidMount() {
        this.props.getOTU(this.props.match.params.otuId);
    }

    render = () => {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null || this.props.detail.id !== this.props.match.params.otuId) {
            return <LoadingPlaceholder />;
        }

        const refId = this.props.detail.reference.id;
        const { id, name, abbreviation } = this.props.detail;

        let iconButtons = [];
        let modifyOTUComponents;

        if (this.props.canModify) {
            iconButtons = (
                <span>
                    <small key="edit-icon" style={{ paddingLeft: "5px" }}>
                        <Icon
                            bsStyle="warning"
                            name="pencil-alt"
                            tip="Edit OTU"
                            tipPlacement="left"
                            onClick={this.props.showEdit}
                        />
                    </small>

                    <small key="remove-icon" style={{ paddingLeft: "5px" }}>
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

            modifyOTUComponents = (
                <div>
                    <EditOTU otuId={id} name={name} abbreviation={abbreviation} />
                    <RemoveOTU id={id} name={name} history={this.props.history} />
                </div>
            );
        }

        return (
            <div>
                <ViewHeader title={`${name} - OTU`} />

                <Breadcrumb>
                    <BreadcrumbItem to="/refs/">References</BreadcrumbItem>
                    <BreadcrumbItem to={`/refs/${refId}`}>{this.props.refName}</BreadcrumbItem>
                    <BreadcrumbItem to={`/refs/${refId}/otus`}>OTUs</BreadcrumbItem>
                    <BreadcrumbItem>{name}</BreadcrumbItem>
                </Breadcrumb>

                <OTUDetailHeader>
                    <strong>{name}</strong>
                    <small>{abbreviation || <em>No Abbreviation</em>}</small>
                    {iconButtons}
                </OTUDetailHeader>

                <Tabs>
                    <TabLink to={`/refs/${refId}/otus/${id}/otu`}>OTU</TabLink>
                    <TabLink to={`/refs/${refId}/otus/${id}/schema`}>Schema</TabLink>
                    <TabLink to={`/refs/${refId}/otus/${id}/history`}>History</TabLink>
                </Tabs>

                {modifyOTUComponents}

                <Switch>
                    <Redirect from="/refs/:refId/otus/:otuId" to={`/refs/${refId}/otus/${id}/otu`} exact />
                    <Route path="/refs/:refId/otus/:otuId/otu" component={OTUSection} />
                    <Route path="/refs/:refId/otus/:otuId/history" component={History} />
                    <Route path="/refs/:refId/otus/:otuId/schema" component={Schema} />
                </Switch>
            </div>
        );
    };
}

const mapStateToProps = state => {
    return {
        error: get(state, "errors.GET_OTU_ERROR", null),
        detail: state.otus.detail,
        refName: state.references.detail.name,
        canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu")
    };
};

const mapDispatchToProps = dispatch => ({
    getOTU: otuId => {
        dispatch(getOTU(otuId));
    },

    showEdit: () => {
        dispatch(showEditOTU());
    },

    showRemove: () => {
        dispatch(showRemoveOTU());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(OTUDetail);
