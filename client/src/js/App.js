import React from "react";
import { Provider, connect } from "react-redux";
import { BrowserRouter, Switch, Route, withRouter } from "react-router-dom";

import NavBar from "./nav/components/Bar";
import Welcome from "./home/components/Welcome";
import Jobs from "./jobs/components/Jobs";
import Samples from "./samples/components/Samples";
import Viruses from "./viruses/components/Viruses";
import Settings from "./settings/components/Settings";

const Inner = (props) => {
    if (props.ready) {
        return (
            <div>
                <NavBar />

                <Switch>
                    <Route path="/" component={Welcome} exact />
                    <Route path="/home" component={Welcome} />
                    <Route path="/jobs" component={Jobs} />
                    <Route path="/samples" component={Samples} />
                    <Route path="/viruses" component={Viruses} />
                    <Route path="/subtraction" component={Welcome} />
                    <Route path="/settings" component={Settings} />
                </Switch>
            </div>
        );
    }

    return (
        <div className="text-center">
            Loading
        </div>
    );
};

Inner.propTypes = {
    ready: React.PropTypes.bool
};

const mapStateToProps = (state) => {
    return {
        ready: state.account.ready && Boolean(Object.keys(state.settings).length)
    };
};

const InnerContainer = withRouter(connect(
    mapStateToProps
)(Inner));

const App = (props) => {
    return (
        <Provider store={props.store}>
            <BrowserRouter>
                <InnerContainer />
            </BrowserRouter>
        </Provider>
    );
};

App.propTypes = {
    store: React.PropTypes.object.isRequired
};

export default App;
