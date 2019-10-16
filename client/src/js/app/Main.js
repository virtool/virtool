import React, { lazy, Suspense, useEffect } from "react";
import { keys } from "lodash-es";
import { Helmet } from "react-helmet";
import { connect } from "react-redux";
import { Switch, Route, Redirect } from "react-router-dom";
import { getAccount } from "../account/actions";

import NavBar from "../nav/components/Bar";
import Sidebar from "../nav/components/Sidebar";

import UploadOverlay from "../files/components/UploadOverlay";
import { getSettings } from "../administration/actions";
import { listProcesses } from "../processes/actions";
import { Container, LoadingPlaceholder } from "../base";
import WSConnection from "./websocket";

const Administration = lazy(() => import("../administration/components/Settings"));
const Account = lazy(() => import("../account/components/Account"));
const HMM = lazy(() => import("../hmm/components/HMM"));
const Jobs = lazy(() => import("../jobs/components/Jobs"));
const References = lazy(() => import("../references/components/References"));
const Samples = lazy(() => import("../samples/components/Samples"));
const Subtraction = lazy(() => import("../subtraction/components/Subtraction"));
const Welcome = lazy(() => import("../home/components/Welcome"));

const Fallback = () => (
    <Container>
        <LoadingPlaceholder />
    </Container>
);

const setupWebSocket = () => {
    if (!window.ws) {
        window.ws = new WSConnection(window.store);
        window.ws.establishConnection();
    }
};

export const Main = ({ ready, onLoad }) => {
    useEffect(() => onLoad(), [ready]);
    useEffect(() => setupWebSocket(), [ready]);

    if (ready) {
        return (
            <div>
                <Helmet titleTemplate="%s - Virtool" defaultTitle="Virtool" />

                <NavBar />

                <Suspense fallback={<Fallback />}>
                    <Switch>
                        <Redirect from="/" to="/home" exact />
                        <Route path="/home" component={Welcome} />
                        <Route path="/jobs" component={Jobs} />
                        <Route path="/samples" component={Samples} />
                        <Route path="/refs" component={References} />
                        <Route path="/hmm" component={HMM} />
                        <Route path="/subtraction" component={Subtraction} />
                        <Route path="/administration" component={Administration} />
                        <Route path="/account" component={Account} />
                    </Switch>
                </Suspense>

                <Sidebar />

                <UploadOverlay />
            </div>
        );
    }

    return <LoadingPlaceholder />;
};

export const mapStateToProps = state => ({
    ready: state.account.ready && Boolean(keys(state.settings).length)
});

export const mapDispatchToProps = dispatch => ({
    onLoad: () => {
        dispatch(getAccount());
        dispatch(getSettings());
        dispatch(listProcesses());
    }
});

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(Main);
