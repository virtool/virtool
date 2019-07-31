import { ConnectedRouter } from "connected-react-router";
import React, { Suspense } from "react";
import { connect, Provider } from "react-redux";
import { ThemeProvider } from "styled-components";
import { WallContainer } from "../wall/Container";
import { theme } from "./theme";
import Main from "./Main";

const LazyFirstUser = React.lazy(() => import("../wall/FirstUser"));
const LazyLogin = React.lazy(() => import("../wall/Login"));

export const App = ({ first, login }) => {
    if (first) {
        return (
            <Suspense fallback={<WallContainer />}>
                <LazyFirstUser />
            </Suspense>
        );
    }

    if (login) {
        return (
            <Suspense fallback={<WallContainer />}>
                <LazyLogin />
            </Suspense>
        );
    }

    return <Main />;
};

export const mapStateToProps = state => {
    const { first, login } = state.app;

    return {
        first,
        login
    };
};

const ConnectedApp = connect(mapStateToProps)(App);

export default ({ store, history }) => (
    <ThemeProvider theme={theme}>
        <Provider store={store}>
            <ConnectedRouter history={history}>
                <ConnectedApp />
            </ConnectedRouter>
        </Provider>
    </ThemeProvider>
);
