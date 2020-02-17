import CX from "classnames";
import React from "react";
import Marked from "marked";
import PropTypes from "prop-types";
import { replace } from "lodash-es";
import { Button } from "react-bootstrap";

import { Icon, Box } from "../../base";

export const ReleaseMarkdown = ({ body, noMargin = false }) => {
    let html = Marked(body);

    html = replace(
        html,
        /#([0-9]+)/g,
        "<a target='_blank' href='https://github.com/virtool/virtool/issues/$1'>#$1</a>"
    );

    return (
        <div className={CX("markdown-container", { "no-margin": noMargin })}>
            <div dangerouslySetInnerHTML={{ __html: html }} />
        </div>
    );
};

export default class Release extends React.Component {
    constructor(props) {
        super(props);

        this.state = {
            in: false
        };
    }

    static propTypes = {
        name: PropTypes.string.isRequired,
        body: PropTypes.string.isRequired,
        html_url: PropTypes.string.isRequired
    };

    handleClick = () => {
        this.setState({
            in: !this.state.in
        });
    };

    render() {
        const caret = <Icon className="fixed-width" name={`caret-${this.state.in ? "down" : "right"}`} />;

        let markdown;

        if (this.state.in) {
            markdown = <ReleaseMarkdown body={this.props.body} />;
        }

        return (
            <Box>
                <div style={{ cursor: "pointer" }} onClick={this.handleClick}>
                    {caret} <strong>{this.props.name}</strong>
                </div>

                <Button bsSize="xsmall" target="_blank" href={this.props.html_url}>
                    <i className="fab fa-github" /> GitHub
                </Button>

                {markdown}
            </Box>
        );
    }
}
