import React from "react";
import { ClipLoader } from "halogenium";
import { connect } from "react-redux";
import { LinkContainer } from "react-router-bootstrap";
import { ListGroup } from "react-bootstrap";

import APIKey from "./Key";
import CreateAPIKey from "./Create";
import { getAPIKeys, createAPIKey, updateAPIKey, removeAPIKey } from "../../actions";
import { Button, Icon, Flex, FlexItem, ListGroupItem } from "../../../base/index";

class APIKeys extends React.Component {

    componentWillMount () {
        this.props.onGet();
    }

    render () {

        if (this.props.apiKeys === null) {
            return (
                <div className="text-center" style={{marginTop: "150px"}}>
                    <ClipLoader color="#3c8786" size="24px"/>
                </div>
            );
        }

        let keyComponents = this.props.apiKeys.map(apiKey =>
            <APIKey
                key={apiKey.id}
                apiKey={apiKey}
                permissions={this.props.permissions}
                onUpdate={this.props.onUpdate}
                onRemove={this.props.onRemove}
            />
        );

        if (!keyComponents.length) {
            keyComponents = (
                <ListGroupItem className="text-center">
                    <Icon name="info"/> No API keys found.
                </ListGroupItem>
            );
        }

        return (
            <div>
                <Flex alignItems="center" style={{marginTop: "-7px", marginBottom: "10px"}}>
                    <FlexItem>
                        <div style={{whiteSpace: "wrap"}}>
                            <span>Manage API keys for accessing the </span>
                            <a
                                href="https://docs.virtool.ca/web-api/authentication.html"
                                rel="noopener noreferrer"
                                target="_blank">Virtool API
                            </a>.
                        </div>
                    </FlexItem>
                    <FlexItem grow={1} shrink={0} pad={7}>
                        <LinkContainer to={{state: {createAPIKey: true}}} className="pull-right">
                            <Button bsStyle="primary" icon="key" pullRight>
                                Create
                            </Button>
                        </LinkContainer>
                    </FlexItem>
                </Flex>

                <ListGroup>
                    {keyComponents}
                </ListGroup>

                <CreateAPIKey
                    permissions={this.props.permissions}
                    onHide={() => this.props.history.push({state: {createAPIKey: false}})}
                    onCreate={this.props.onCreate}
                />
            </div>
        );
    }
}

const mapStateToProps = (state) => ({
    apiKeys: state.account.apiKeys,
    permissions: state.account.permissions
});

const mapDispatchToProps = (dispatch) => ({

    onGet: () => {
        dispatch(getAPIKeys());
    },

    onCreate: (name, permissions, callback) => {
        dispatch(createAPIKey(name, permissions, callback));
    },

    onUpdate: (keyId, permissions) => {
        dispatch(updateAPIKey(keyId, permissions));
    },

    onRemove: (keyId) => {
        dispatch(removeAPIKey(keyId));
    }

});

const Container = connect(mapStateToProps, mapDispatchToProps)(APIKeys);

export default Container;
