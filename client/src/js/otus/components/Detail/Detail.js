import { get } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link, Redirect, Route, Switch } from "react-router-dom";
import styled from "styled-components";
import { getFontWeight } from "../../../app/theme";
import {
    Icon,
    LoadingPlaceholder,
    NotFound,
    TabLink,
    Tabs,
    ViewHeader,
    ViewHeaderIcons,
    ViewHeaderTitle
} from "../../../base";
import { checkRefRight } from "../../../utils/utils";
import { getOTU, showEditOTU, showRemoveOTU } from "../../actions";
import EditOTU from "./Edit";
import IsolateEditor from "./Editor";
import General from "./General";
import History from "./History/History";
import AddIsolate from "./Isolates/Add";
import RemoveOTU from "./Remove";
import Schema from "./Schema/Schema";

const OTUSection = () => (
    <div>
        <General />
        <IsolateEditor />
        <AddIsolate />
    </div>
);

const OTUDetailTitle = styled(ViewHeaderTitle)`
    align-items: baseline;
    display: flex;

    small {
        color: ${props => props.theme.color.greyDark};
        font-weight: 600;
        margin-left: 7px;

        em {
            font-weight: normal;
        }
    }
`;

const OTUDetailSubtitle = styled.p`
    font-size: ${props => props.theme.fontSize.md};
    margin-top: 5px;

    strong {
        font-weight: ${getFontWeight("thick")};
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

        let modifyOTUComponents;

        let segmentComponent;
        if (this.props.dataType !== "barcode") {
            segmentComponent = <TabLink to={`/refs/${refId}/otus/${id}/schema`}>Schema</TabLink>;
        }

        let iconButtons;

        if (this.props.canModify) {
            iconButtons = (
                <ViewHeaderIcons>
                    <Icon
                        key="edit-icon"
                        color="orange"
                        name="pencil-alt"
                        tip="Edit OTU"
                        tipPlacement="left"
                        onClick={this.props.showEdit}
                    />
                    <Icon
                        key="remove-icon"
                        color="red"
                        name="trash"
                        tip="Remove OTU"
                        tipPlacement="left"
                        onClick={this.props.showRemove}
                    />
                </ViewHeaderIcons>
            );

            modifyOTUComponents = (
                <div>
                    <EditOTU otuId={id} name={name} abbreviation={abbreviation} />
                    <RemoveOTU id={id} name={name} history={this.props.history} />
                </div>
            );
        }

        return (
            <React.Fragment>
                <ViewHeader title={name}>
                    <OTUDetailTitle>
                        {name} <small>{abbreviation || <em>No Abbreviation</em>}</small>
                        {iconButtons}
                    </OTUDetailTitle>
                    <OTUDetailSubtitle>
                        <strong>From Reference / </strong>
                        <Link to={`/refs/${this.props.detail.reference.id}`}>{this.props.refName}</Link>
                    </OTUDetailSubtitle>
                </ViewHeader>

                <Tabs>
                    <TabLink to={`/refs/${refId}/otus/${id}/otu`}>OTU</TabLink>
                    {segmentComponent}
                    <TabLink to={`/refs/${refId}/otus/${id}/history`}>History</TabLink>
                </Tabs>

                {modifyOTUComponents}

                <Switch>
                    <Redirect from="/refs/:refId/otus/:otuId" to={`/refs/${refId}/otus/${id}/otu`} exact />
                    <Route path="/refs/:refId/otus/:otuId/otu" component={OTUSection} />
                    <Route path="/refs/:refId/otus/:otuId/history" component={History} />
                    <Route path="/refs/:refId/otus/:otuId/schema" component={Schema} />
                </Switch>
            </React.Fragment>
        );
    };
}

const mapStateToProps = state => {
    return {
        error: get(state, "errors.GET_OTU_ERROR", null),
        detail: state.otus.detail,
        refName: state.references.detail.name,
        canModify: !get(state, "references.detail.remotes_from") && checkRefRight(state, "modify_otu"),
        dataType: state.references.detail.data_type
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
