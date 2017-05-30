import React from "react";
import { Provider, connect } from "react-redux";
import { BrowserRouter, Route, withRouter } from "react-router-dom";

import NavBar from "./Nav/Bar";
import Welcome from "./Home/Welcome";
import Viruses from "./Viruses/Manage/Manage";

const Inner = (props) => {
    if (props.ready) {
        return (
            <div id="app" style={{display: "flex", flexFlow: "column nowrap"}}>
                <NavBar />
                <div>
                    <Route exact path="/" component={Welcome} />
                    <Route path="/jobs" component={Welcome} />
                    <Route path="/samples" component={Welcome} />
                    <Route path="/viruses" component={Viruses} />
                    <Route path="/subtraction" component={Welcome} />
                    <Route path="/settings" component={Welcome} />
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
        ready: state.account.ready
    };
};

const InnerContainer = withRouter(connect(
    mapStateToProps
)(Inner));

const App = (props) => {

    console.log(props.store.getState());

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
