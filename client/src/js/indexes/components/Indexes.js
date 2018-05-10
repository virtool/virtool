import React from "react";
import { Switch, Route } from "react-router-dom";

import IndexesList from "./List";
import IndexDetail from "./Detail";

const Indexes = () => (
    <Switch>
        <Route path="/refs/:refId/indexes" component={IndexesList} exact />
        <Route path="/refs/:refId/indexes/:indexVersion" component={IndexDetail} />
    </Switch>
);

export default Indexes;
