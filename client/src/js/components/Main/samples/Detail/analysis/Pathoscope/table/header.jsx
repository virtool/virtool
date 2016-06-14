var React = require("react");
var Icon = require('virtool/js/components/Base/Icon.jsx');

var Title = React.createClass({

    onClick: function () {
        this.props.sortTable(this.props.property);
    },

    render: function () {

        var thClass = 'col-sm-' + this.props.size + ' hoverable';
        var label = this.props.label;

        if (this.props.active) {
            label = <span>{label} <Icon name={this.props.descending ? 'caret-down': 'caret-up'} /></span>;
        }

        return <th onClick={this.onClick} className={thClass}>{label}</th>;
    }

});

var Header = React.createClass({

    render: function () {

        var titles = [
            {
                label: "Virus",
                property: "name",
                size: 4
            },
            {
                label: "Weighted",
                property: "pi",
                size: 2
            },
            {
                label: "Best Hit",
                property: "best",
                size: 2
            },
            {
                label: "Relative",
                property: "relative",
                size: 2
            },
            {
                label: "Coverage",
                property: "coverage",
                size: this.props.useRelative ? 2: 4
            }
        ];

        if (!this.props.useRelative) titles.splice(3, 1);

        var titleComponents = titles.map(function (title) {

            return (
                <Title
                    {...title}
                    {...this.props}
                    key={title.property}
                    active={title.property === this.props.sortedBy}
                />
            )
        }, this);

        return (

            <thead>
                <tr>
                    {titleComponents}
                </tr>
            </thead>
        )
    }
});

module.exports = Header;