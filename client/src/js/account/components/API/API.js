import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { Link } from "react-router-dom";
import styled from "styled-components";
import { ExternalLink, FlexItem, LoadingPlaceholder, NoneFoundBox } from "../../../base/index";

import { getAPIKeys } from "../../actions";
import CreateAPIKey from "./Create";
import APIKey from "./Key";

const APIKeysHeader = styled.div`
    align-items: center;
    display: flex;
    margin-bottom: 10px;

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
                    <FlexItem>
                        <div style={{ whiteSpace: "wrap" }}>
                            <span>Manage API keys for accessing the </span>
                            <ExternalLink href="https://www.virtool.ca/docs/web-api/authentication.html">
                                Virtool API
                            </ExternalLink>
                            <span>.</span>
                        </div>
                    </FlexItem>
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
