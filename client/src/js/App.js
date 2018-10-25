import React from "react";
import { keys } from "lodash-es";
import { Helmet } from "react-helmet";
import { Provider, connect } from "react-redux";
import { ConnectedRouter } from "react-router-redux";
import { Switch, Route, withRouter, Redirect } from "react-router-dom";

import NavBar from "./nav/components/Bar";
import Sidebar from "./nav/components/Sidebar";
import Welcome from "./home/components/Welcome";
import Jobs from "./jobs/components/Jobs";
import Samples from "./samples/components/Samples";
import References from "./references/components/References";
import HMM from "./hmm/components/HMM";
import Subtraction from "./subtraction/components/Subtraction";
import Administration from "./administration/components/Settings";
import Account from "./account/components/Account";
import UploadOverlay from "./files/components/UploadOverlay";
import { LoadingPlaceholder } from "./base";

export const Inner = props => {
    if (props.ready) {
        return (
            <div>
                <Helmet titleTemplate="%s - Virtool" defaultTitle="Virtool" />

                <NavBar />

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

                <Sidebar />

                <UploadOverlay />
            </div>
        );
    }

    return <LoadingPlaceholder margin="290px" />;
};

const mapStateToProps = state => ({
    ready: state.account.ready && Boolean(keys(state.settings).length)
});

export const InnerContainer = withRouter(connect(mapStateToProps)(Inner));

const App = ({ store, history }) => (
    <Provider store={store}>
        <ConnectedRouter history={history}>
            <InnerContainer />
        </ConnectedRouter>
    </Provider>
);

export default App;
