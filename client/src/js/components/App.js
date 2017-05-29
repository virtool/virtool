import React from "react";
import { Provider } from "react-redux";
import { BrowserRouter, Route } from "react-router-dom";

import NavBar from "./Nav/NavBar";
import Welcome from "./Home/Welcome";
// import Viruses from "./Viruses/Manage/Manage";

const App = (props) => (
    <Provider store={props.store}>
        <BrowserRouter>
            <div id="app" style={{display: "flex", flexFlow: "column nowrap"}}>
                <NavBar />
                <div>
                    <Route exact path="/" component={Welcome} />
                    <Route path="/jobs" component={Welcome} />
                    <Route path="/samples" component={Welcome} />
                    <Route path="/viruses" component={Welcome} />
                    <Route path="/subtraction" component={Welcome} />
                    <Route path="/settings" component={Welcome} />
                </div>
            </div>
        </BrowserRouter>
    </Provider>
);

App.propTypes = {
    store: React.PropTypes.object.isRequired
};

export default App;
