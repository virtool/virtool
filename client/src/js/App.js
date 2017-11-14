import React from "react";
import { Helmet } from "react-helmet";
import { ClipLoader } from "halogenium";
import { Provider, connect } from "react-redux";
import { ConnectedRouter } from "react-router-redux";
import { Switch, Route, withRouter } from "react-router-dom";

import NavBar from "./nav/components/Bar";
import Welcome from "./home/components/Welcome";
import Jobs from "./jobs/components/Jobs";
import Samples from "./samples/components/Samples";
import Viruses from "./viruses/components/Viruses";
import HMM from "./hmm/components/HMM";
import Subtraction from "./subtraction/components/Subtraction";
import Settings from "./settings/components/Settings";
import Account from "./account/components/Account";
import UploadOverlay from "./files/components/UploadOverlay";

const Inner = (props) => {
    if (props.ready) {
        return (
            <div>
                <Helmet titleTemplate="Virtool - %s" defaultTitle="Virtool" />

                <NavBar />

                <Switch>
                    <Route path="/" component={Welcome} exact />
                    <Route path="/home" component={Welcome} />
                    <Route path="/jobs" component={Jobs} />
                    <Route path="/samples" component={Samples} />
                    <Route path="/viruses" component={Viruses} />
                    <Route path="/hmm" component={HMM} />
                    <Route path="/subtraction" component={Subtraction} />
                    <Route path="/settings" component={Settings} />
                    <Route path="/account" component={Account} />
                </Switch>

                <UploadOverlay />
            </div>
        );
    }

    return (
        <div className="text-center" style={{paddingTop: "290px"}}>
            <ClipLoader />
        </div>
    );
};

const mapStateToProps = (state) => {
    return {
        ready: state.account.ready && Boolean(Object.keys(state.settings).length)
    };
};

const InnerContainer = withRouter(connect(
    mapStateToProps
)(Inner));

const App = ({ store, history }) => {
    return (
        <Provider store={store}>
            <ConnectedRouter history={history}>
                <InnerContainer />
            </ConnectedRouter>
        </Provider>
    );
};

export default App;
