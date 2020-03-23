import { get, includes } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link, Redirect, Route, Switch } from "react-router-dom";

import Analyses from "../../analyses/components/Analyses";
import {
    Icon,
    LoadingPlaceholder,
    NotFound,
    TabLink,
    Tabs,
    ViewHeader,
    ViewHeaderAttribution,
    ViewHeaderIcons,
    ViewHeaderTitle
} from "../../base";
import Cache from "../../caches/components/Detail";
import { getSample, hideSampleModal, showRemoveSample } from "../actions";
import { getCanModify } from "../selectors";
import Files from "./Files/Files";
import General from "./General";
import Quality from "./Quality";
import RemoveSample from "./Remove";
import Rights from "./Rights";

class SampleDetail extends React.Component {
    componentDidMount() {
        this.props.getSample(this.props.match.params.sampleId);
    }

    componentWillUnmount() {
        this.props.onHide();
    }

    render() {
        if (this.props.error) {
            return <NotFound />;
        }

        if (this.props.detail === null) {
            return <LoadingPlaceholder />;
        }

        if (!this.props.detail.ready) {
            return <LoadingPlaceholder message="Sample is still being created." margin="220px" />;
        }

        const detail = this.props.detail;
        const sampleId = this.props.match.params.sampleId;

        let editIcon;
        let removeIcon;
        let rightsTabLink;

        if (this.props.canModify) {
            if (includes(this.props.history.location.pathname, "general")) {
                editIcon = (
                    <Link to={{ state: { editSample: true } }}>
                        <Icon color="orange" name="pencil-alt" tip="Edit" hoverable />
                    </Link>
                );
            }

            removeIcon = (
                <Link to={{ state: { removeSample: true } }}>
                    <Icon color="red" name="trash" tip="Remove" hoverable />
                </Link>
            );

            rightsTabLink = (
                <TabLink to={`/samples/${sampleId}/rights`}>
                    <Icon name="key" />
                </TabLink>
            );
        }

        const { created_at, user } = this.props.detail;

        const prefix = `/samples/${sampleId}`;

        return (
            <div>
                <ViewHeader title={detail.name}>
                    <ViewHeaderTitle>
                        {detail.name}
                        <ViewHeaderIcons>
                            {editIcon}
                            {removeIcon}
                        </ViewHeaderIcons>
                    </ViewHeaderTitle>
                    <ViewHeaderAttribution time={created_at} user={user.id} />
                </ViewHeader>

                <Tabs bsStyle="tabs">
                    <TabLink to={`${prefix}/general`}>General</TabLink>
                    <TabLink to={`${prefix}/files`}>Files</TabLink>
                    <TabLink to={`${prefix}/quality`}>Quality</TabLink>
                    <TabLink to={`${prefix}/analyses`}>Analyses</TabLink>
                    {rightsTabLink}
                </Tabs>

                <Switch>
                    <Redirect from="/samples/:sampleId" to={`/samples/${sampleId}/general`} exact />
                    <Route path="/samples/:sampleId/general" component={General} />
                    <Route path="/samples/:sampleId/files" component={Files} exact />
                    <Route path="/samples/:sampleId/files/:cacheId" component={Cache} />
                    <Route path="/samples/:sampleId/quality" component={Quality} />
                    <Route path="/samples/:sampleId/analyses" component={Analyses} />
                    <Route path="/samples/:sampleId/rights" component={Rights} />
                </Switch>

                <RemoveSample />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    error: get(state, "errors.GET_SAMPLE_ERROR", null),
    detail: state.samples.detail,
    canModify: getCanModify(state)
});

const mapDispatchToProps = dispatch => ({
    getSample: sampleId => {
        dispatch(getSample(sampleId));
    },

    showRemove: (sampleId, sampleName) => {
        dispatch(showRemoveSample(sampleId, sampleName));
    },

    onHide: () => {
        dispatch(hideSampleModal());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleDetail);
