import { ConnectedRouter } from "connected-react-router";
import React, { Suspense } from "react";
import { connect, Provider } from "react-redux";
import { ThemeProvider } from "styled-components";
import { WallContainer } from "../wall/Container";
import Reset from "../wall/Reset";
import Main from "./Main";
import { theme } from "./theme";
import { GlobalStyles } from "./GlobalStyles";

const LazyFirstUser = React.lazy(() => import("../wall/FirstUser"));
const LazyLogin = React.lazy(() => import("../wall/Login"));

export const App = ({ first, login, reset }) => {
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

    if (reset) {
        return <Reset />;
    }

    return <Main />;
};

export const mapStateToProps = state => {
    const { first, login, reset } = state.app;

    return {
        first,
        login,
        reset
    };
};

const ConnectedApp = connect(mapStateToProps)(App);

export default ({ store, history }) => (
    <ThemeProvider theme={theme}>
        <Provider store={store}>
            <ConnectedRouter history={history}>
                <GlobalStyles />
                <ConnectedApp />
            </ConnectedRouter>
        </Provider>
    </ThemeProvider>
);
