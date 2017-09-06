/**
 *
 *
 * @copyright 2017 Government of Canada
 * @license MIT
 * @author igboyes
 *
 */

import React, { PropTypes } from "react";
import Marked from "marked";
import { ListGroupItem, Button, Row, Col } from "react-bootstrap";

const renderReleaseMarkdown = (body) => {
    let html = Marked(body);

    html = html.replace(/#([0-9]+)/g, `<a target="_blank" href="https://github.com/virtool/virtool/issues/$1">#$1</a>`);

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
        body: PropTypes.string
    };

    render () {
        return (
            <ListGroupItem>
                <Row>
                    <Col xs={12}>
                        <strong>{this.props.name}</strong>
                        <span className="pull-right">
                            <Button bsSize="xsmall" target="_blank" href={this.props.html_url}>
                                <i className="i-github" /> GitHub
                            </Button>
                        </span>
                    </Col>
                    <Col xs={12}>
                        {renderReleaseMarkdown(this.props.body)}
                    </Col>
                </Row>
            </ListGroupItem>
        );
    }
}
