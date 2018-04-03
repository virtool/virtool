import React from "react";
import Marked from "marked";
import PropTypes from "prop-types";
import { replace } from "lodash-es";
import { Button, Col, ListGroupItem, Row } from "react-bootstrap";

import { Icon } from "../../base";

export const renderReleaseMarkdown = (body) => {
    let html = Marked(body);

    html = replace(
        html,
        /#([0-9]+)/g,
        "<a target='_blank' href='https://github.com/virtool/virtool/issues/$1'>#$1</a>"
    );

    return <div style={{marginTop: "10px"}} dangerouslySetInnerHTML={{__html: html}} />;
};

export default class Release extends React.Component {

    constructor (props) {
        super(props);

        this.state = {
            in: false
        };
    }

    static propTypes = {
        name: PropTypes.string,
        body: PropTypes.string,
        html_url: PropTypes.string
    };

    handleClick = () => {
        this.setState({
            in: !this.state.in
        });
    };

    render () {

        const caret = (
            <Icon
                className="fixed-width"
                name={`caret-${this.state.in ? "down" : "right"}`}
            />
        );

        let markdown;

        if (this.state.in) {
            markdown = (
                <Col xs={12} className="markdown-container">
                    {renderReleaseMarkdown(this.props.body)}
                </Col>
            );
        }

        return (
            <ListGroupItem>
                <Row>
                    <Col xs={12}>
                        <Row>
                            <Col xs={9} style={{cursor: "pointer"}} onClick={this.handleClick}>
                                {caret} <strong>{this.props.name}</strong>
                            </Col>
                            <Col xs={3}>
                                <Button bsSize="xsmall" target="_blank" href={this.props.html_url}>
                                    <i className="i-github" /> GitHub
                                </Button>
                            </Col>
                        </Row>
                    </Col>

                    {markdown}
                </Row>
            </ListGroupItem>
        );
    }
}
