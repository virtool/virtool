import { map } from "lodash-es";
import React from "react";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { Button, Flex, FlexItem, LoadingPlaceholder, NoneFound } from "../../../base/index";

import { getAPIKeys } from "../../actions";
import CreateAPIKey from "./Create";
import APIKey from "./Key";

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
            keyComponents = <NoneFound noun="API keys" />;
        }

        return (
            <div>
                <Flex alignItems="center" style={{ marginTop: "-7px", marginBottom: "10px" }}>
                    <FlexItem>
                        <div style={{ whiteSpace: "wrap" }}>
                            <span>Manage API keys for accessing the </span>
                            <a
                                href="https://docs.virtool.ca/web-api/authentication.html"
                                rel="noopener noreferrer"
                                target="_blank"
                            >
                                Virtool API
                            </a>
                            <span>.</span>
                        </div>
                    </FlexItem>
                    <FlexItem grow={1} shrink={0} pad={7}>
                        <LinkContainer to={{ state: { createAPIKey: true } }} className="pull-right">
                            <Button bsStyle="primary" icon="key" pullRight>
                                Create
                            </Button>
                        </LinkContainer>
                    </FlexItem>
                </Flex>

                <div>{keyComponents}</div>

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

export default connect(
    mapStateToProps,
    mapDispatchToProps
)(APIKeys);
