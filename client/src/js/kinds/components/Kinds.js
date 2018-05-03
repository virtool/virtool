import React from "react";
import { Switch, Route } from "react-router-dom";

import KindsList from "./List";

const kinds = () => (
    <div className="container">
        <Switch>
            <Route path="/refs/:refId/kinds" component={KindsList} exact />
        </Switch>
    </div>
);

export default kinds;
