import React, { lazy, Suspense, useEffect } from "react";
import { Helmet } from "react-helmet";
import { connect } from "react-redux";
import { Redirect, Route, Switch } from "react-router-dom";
import styled from "styled-components";
import { getAccount } from "../account/actions";
import { getSettings } from "../administration/actions";
import { Container, LoadingPlaceholder } from "../base";
import DevDialog from "../dev/components/Dialog";
import UploadOverlay from "../files/components/UploadOverlay";
import NavBar from "../nav/components/NavBar";
import Sidebar from "../nav/components/Sidebar";
import { listTasks } from "../tasks/actions";
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

const MainContainer = styled.div`
    padding-top: 80px;
`;

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
            <React.Fragment>
                <Helmet>
                    <title>Virtool</title>
                    <meta charSet="utf-8" />
                </Helmet>

                <NavBar />

                <MainContainer>
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
                </MainContainer>

                <Sidebar />

                <DevDialog />
                <UploadOverlay />
            </React.Fragment>
        );
    }

    return <LoadingPlaceholder />;
};

export const mapStateToProps = state => ({
    ready: state.account.ready && Boolean(state.settings.data)
});

export const mapDispatchToProps = dispatch => ({
    onLoad: () => {
        dispatch(getAccount());
        dispatch(getSettings());
        dispatch(listTasks());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(Main);
