import React from "react";
import { Switch, Route } from "react-router-dom";

import VirusesList from "./List";
import VirusDetail from "./Detail/Detail";
import Indexes from "../../indexes/components/Indexes";

const Viruses = () => (
    <div className="container">
        <Switch>
            <Route path="/viruses" component={VirusesList} exact />
            <Route path="/viruses/create" component={VirusesList} />
            <Route path="/viruses/indexes" component={Indexes} />
            <Route path="/viruses/:virusId" component={VirusDetail} />
        </Switch>
    </div>
);

export default Viruses;
