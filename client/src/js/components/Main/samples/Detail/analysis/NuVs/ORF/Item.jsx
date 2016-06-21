var React = require('react');
var Input = require('react-bootstrap/lib/Input');

var ListGroupItem = require('virtool/js/components/Base/PushListGroupItem.jsx');

var Icon = require('virtool/js/components/Base/Icon.jsx');

var ORFItem = React.createClass({

    render: function () {

        var arrow = <Icon name={'arrow-' + (this.props.strand === 1 ? 'right': 'left')} />;

        return (
            <ListGroupItem>
                <h5>{this.props.frame} {arrow} ORF {this.props.index}.{this.props.orf_index}</h5>
                <Input type='textarea' value={this.props.pro} className='sequence' readOnly />
            </ListGroupItem>
        );
    }

});

module.exports = ORFItem;