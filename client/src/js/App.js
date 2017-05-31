import React from "react";
import { Provider, connect } from "react-redux";
import { BrowserRouter, Route, withRouter } from "react-router-dom";

import NavBar from "./nav/components/Bar";
import Welcome from "./components/Home/Welcome";
import Viruses from "./viruses/components/Manage/Manage";
import Settings from "./settings/components/Settings";

const Inner = (props) => {
    if (props.ready) {
        return (
            <div>
                <NavBar />

                <div>
                    <Route exact path="/" component={Welcome} />
                    <Route path="/jobs" component={Welcome} />
                    <Route path="/samples" component={Welcome} />
                    <Route path="/viruses" component={Viruses} />
                    <Route path="/subtraction" component={Welcome} />
                    <Route path="/settings" component={Settings} />
                </div>
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
