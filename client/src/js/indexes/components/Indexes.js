import React from "react";
import { Route, Switch } from "react-router-dom";
import IndexesList from "./List";

const Indexes = () => (
    <Switch>
        <Route path="/refs/:refId/indexes" component={IndexesList} exact />
    </Switch>
);

export default Indexes;
