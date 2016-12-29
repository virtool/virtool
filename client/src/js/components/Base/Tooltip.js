import React from "react";

export default class Tooltip extends React.Component {

    static propTypes = {
        x: React.PropTypes.number,
        y: React.PropTypes.number,

        header: React.PropTypes.oneOfType([
            React.PropTypes.string,
            React.PropTypes.element
        ]),

        children: React.PropTypes.element
    };

    render () {

        const tooltipStyle = {
            left: (this.props.x - 10) + "px",
            top: (this.props.y - window.pageYOffset - 10) + "px",
            zIndex: 10000
        };

        let header;

        if (this.props.header) {
            header = (
                <div className="tooltip-header">
                    {this.props.header}
                </div>
            );
        }

        return (
            <div className="tooltip" style={tooltipStyle}>
                {header}
                <div className="tooltip-body">
                    {this.props.children}
                </div>
            </div>
        );
    }

}
