import React from "react";
import { map } from "lodash-es";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroup } from "react-bootstrap";

import { getAPIKeys } from "../../actions";
import { Button, Flex, FlexItem, LoadingPlaceholder, NoneFound } from "../../../base/index";
import APIKey from "./Key";
import CreateAPIKey from "./Create";

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

                <ListGroup>{keyComponents}</ListGroup>

                <CreateAPIKey permissions={this.props.permissions} onCreate={this.props.onCreate} />
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
