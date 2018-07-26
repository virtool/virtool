/* global module, __dirname */
const path = require("path");
const webpack = require("webpack");
const HTMLPlugin = require("html-webpack-plugin");
const CleanPlugin = require("clean-webpack-plugin");
const ExtractTextPlugin = require("extract-text-webpack-plugin");
const UglifyJSPlugin = require("uglifyjs-webpack-plugin");

module.exports = {

    entry: ["babel-polyfill", "./src/js/index.js"],

    module: {
        rules: [
            {
                test: /\.js$/,
                exclude: /(node_modules)/,
                use: [
                    "babel-loader",
                    {
                        loader: "eslint-loader",
                        options: {
                            configFile: path.resolve(__dirname, "./.eslintrc")
                        }

                    }
                ]
            },

            {
                test: /\.css$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: "css-loader"
                })
            },

            {
                test: /\.less$/,
                use: ExtractTextPlugin.extract({
                    fallback: "style-loader",
                    use: [
                        {loader: "css-loader"},
                        {loader: "less-loader"}
                    ]
                })
            },

            {
                test: /\.woff$/,
                use: {
                    loader: "url-loader?limit=100000"
                }
            }
        ]
    },

    node: {
        fs: "empty"
    },

    mode: "production",

    output: {
        path: path.resolve(__dirname, "./dist"),
        filename: "app.[hash:8].js",
        sourceMapFilename: "[name].js.map",
        publicPath: "/static/"
    },

    plugins: [
        new webpack.DefinePlugin({
            "process.env": {
                NODE_ENV: JSON.stringify("production")
            }
        }),

        new ExtractTextPlugin("style.[hash:8].css"),

        new HTMLPlugin({
            filename: "index.html",
            title: "Virtool",
            favicon: "./src/images/favicon.ico",
            template: "./src/index.html",
            inject: "body"
        }),

        new CleanPlugin(["dist"], {
            verbose: true
        }),

        new UglifyJSPlugin({
            sourceMap: true
        })
    ]
};
