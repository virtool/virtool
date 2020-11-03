import { includes } from "lodash-es";
import React, { useEffect } from "react";
import { connect } from "react-redux";
import { Link, Redirect, Route, Switch } from "react-router-dom";

import Analyses from "../../analyses/components/Analyses";
import {
    Icon,
    LinkIcon,
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
import { getError } from "../../errors/selectors";
import { getSample } from "../actions";
import { getCanModify } from "../selectors";
import Files from "./Files/Files";
import General from "./General";
import Quality from "./Quality";
import RemoveSample from "./Remove";
import Rights from "./Rights";

const SampleDetail = ({ canModify, detail, error, history, match, onGetSample }) => {
    const sampleId = match.params.sampleId;

    useEffect(() => {
        onGetSample(sampleId);
    }, [sampleId]);

    if (error) {
        return <NotFound />;
    }

    if (detail === null) {
        return <LoadingPlaceholder />;
    }

    if (!detail.ready) {
        return <LoadingPlaceholder message="Sample is still being created." margin="220px" />;
    }

    let editIcon;
    let removeIcon;
    let labelIcon;
    let rightsTabLink;

    if (canModify) {
        if (includes(history.location.pathname, "general")) {
            editIcon = (
                <Link to={{ state: { editSample: true } }}>
                    <Icon color="orange" name="pencil-alt" tip="Edit" hoverable />
                </Link>
            );
        }

        removeIcon = <LinkIcon color="red" to={{ state: { removeSample: true } }} name="trash" tip="Remove" />;

        labelIcon = <LinkIcon color="blue" to={{ state: { labelEdit: true } }} name="fas fa-tag" tip="Labels" />;

        rightsTabLink = (
            <TabLink to={`/samples/${sampleId}/rights`}>
                <Icon name="key" />
            </TabLink>
        );
    }

    const { created_at, user } = detail;

    const prefix = `/samples/${sampleId}`;

    return (
        <div>
            <ViewHeader title={detail.name}>
                <ViewHeaderTitle>
                    {detail.name}
                    <ViewHeaderIcons>
                        {editIcon}
                        {labelIcon}
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
};

export const mapStateToProps = state => ({
    canModify: getCanModify(state),
    detail: state.samples.detail,
    error: getError("GET_SAMPLE_ERROR")
});

export const mapDispatchToProps = dispatch => ({
    onGetSample: sampleId => {
        dispatch(getSample(sampleId));
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(SampleDetail);
