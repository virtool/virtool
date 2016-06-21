var _ = require('lodash');
var React = require('react');
var ListGroup = require('react-bootstrap/lib/ListGroup');

var Item = require('./Item.jsx');

var Report = React.createClass({

    render: function () {

        var orfs = _.filter(this.props.orfs, function (orf) {
            return orf.pro.length > 14;
        });

        var orfComponents = orfs.map(function (orf, index) {
            return <Item key={index} {...orf} />;
        });

        var listStyle = {
            height: '420px',
            overflowY: 'auto'
        };

        return (
            <ListGroup style={listStyle}>
                {orfComponents}
            </ListGroup>
        );
    }

});

module.exports = Report;