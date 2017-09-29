/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React from "react";
import { Switch, Route } from "react-router-dom";

import VirusesList from "./List";
import VirusDetail from "./Detail/Detail";
import VirusImport from "./Import";
import Indexes from "../../indexes/components/Indexes";

const Viruses = () => {
    return (
        <div className="container">
            <Switch>
                <Route path="/viruses" component={VirusesList} exact />
                <Route path="/viruses/create" component={VirusesList} />
                <Route path="/viruses/indexes" component={Indexes} />
                <Route path="/viruses/:virusId" component={VirusDetail} />
            </Switch>

            <Route path="/viruses" children={({ history }) => (
                <VirusImport
                    show={history.location.state && history.location.state.virusImport}
                    onHide={() => history.push(history.location.pathname, {virusImport: false})}
                />
            )} />
        </div>
    );
};

export default Viruses;
