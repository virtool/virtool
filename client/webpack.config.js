var path = require('path');
var webpack = require('webpack');
var HTMLPlugin = require('html-webpack-plugin');
var CleanPlugin = require('clean-webpack-plugin');

var config = {

    entry: './src/js/app.js',

    module: {
        loaders: [
            {
                test: /(\.jsx|\.js)$/,
                exclude: /(node_modules)/,
                loader: 'babel-loader',
                query: {
                    presets: ["es2015", "react"]
                }
            },

            {test: /\.css$/, loader: 'style!css'},
            {test: /\.woff$/, loader: 'url?limit=100000'}
        ]
    },

    resolve: {
        alias: {virtool: path.resolve(__dirname, './src')}
    },

    node: {
        fs: "empty"
    },

    output: {
        path: 'dist',
        filename: 'app.[hash].js'
    },

    plugins: [
        new HTMLPlugin({
            filename: 'index.html',
            title: 'Virtool',
            favicon: './src/images/favicon.ico',
            template: './src/index.html',
            inject: 'body'
        }),

        new CleanPlugin(['dist'], {
            verbose: true
        })
    ],

    progress: true,
    colors: true,
    watch: true
};

module.exports = config;