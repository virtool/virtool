import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { Box, ExternalLink, LoadingPlaceholder, NoneFoundBox } from "../../../base/index";

import { getAPIKeys } from "../../actions";
import CreateAPIKey from "./Create";
import APIKey from "./Key";

const APIKeysHeader = styled(Box)`
    align-items: center;
    display: flex;
    font-weight: bold;
    margin-bottom: 15px;

    > a:last-child {
        font-weight: bold;
        margin-left: auto;
    }
`;

export class APIKeys extends React.Component {
    componentDidMount() {
        this.props.onGet();
    }

    render() {
        if (this.props.apiKeys === null) {
            return <LoadingPlaceholder margin="150px" />;
        }

        let keyComponents = map(this.props.apiKeys, apiKey => <APIKey key={apiKey.id} apiKey={apiKey} />);

        if (!keyComponents.length) {
            keyComponents = <NoneFoundBox noun="API keys" />;
        }

        return (
            <div>
                <APIKeysHeader>
                    <div style={{ whiteSpace: "wrap" }}>
                        <span>Manage API keys for accessing the </span>
                        <ExternalLink href="https://www.virtool.ca/docs/developer/api_account/">
                            Virtool API
                        </ExternalLink>
                        <span>.</span>
                    </div>
                    <Link to={{ state: { createAPIKey: true } }}>Create</Link>
                </APIKeysHeader>

                {keyComponents}

                <CreateAPIKey />
            </div>
        );
    }
}

const mapStateToProps = state => ({
    apiKeys: state.account.apiKeys
});

const mapDispatchToProps = dispatch => ({
    onGet: () => {
        dispatch(getAPIKeys());
    }
});

export default connect(mapStateToProps, mapDispatchToProps)(APIKeys);
