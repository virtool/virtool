import React from "react";
import { connect } from "react-redux";
import { Route, Switch } from "react-router-dom";
import { mapSettingsStateToProps } from "../../administration/mappers";
import { Container, LoadingPlaceholder, NarrowContainer } from "../../base";
import JobDetail from "./Detail";
import JobsList from "./List";

export const Jobs = ({ loading }) => {
    if (loading) {
        return <LoadingPlaceholder />;
    }

    return (
        <Container>
            <NarrowContainer>
                <Switch>
                    <Route path="/jobs" component={JobsList} exact />
                    <Route path="/jobs/:jobId" component={JobDetail} />
                </Switch>
            </NarrowContainer>
        </Container>
    );
};

export default connect(mapSettingsStateToProps)(Jobs);
