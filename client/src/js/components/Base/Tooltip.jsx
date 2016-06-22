var React = require('react');

var Tooltip = React.createClass({

    render: function () {

        var tooltipStyle = {
            left: (this.props.x - 10) + 'px',
            top: (this.props.y - 10) + 'px',
            zIndex: 10000
        };
        
        var header;

        if (this.props.header) {
            header = (
                <div className='tooltip-header'>
                    {this.props.header}
                </div>
            );
        }

        return (
            <div className='tooltip' style={tooltipStyle}>
                {header}
                <div className='tooltip-body'>
                    {this.props.children}
                </div>
            </div>
        );
    }

});

module.exports = Tooltip;