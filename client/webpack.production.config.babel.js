const path = require("path");
const { CleanWebpackPlugin } = require("clean-webpack-plugin");
const HTMLPlugin = require("html-webpack-plugin");
const TerserWebpackPlugin = require("terser-webpack-plugin");
const webpack = require("webpack");

module.exports = {
  entry: "./src/js/index.js",

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
              configFile: path.resolve(__dirname, "./.eslintrc"),
            },
          },
        ],
      },

      {
        test: /\.css$/,
        use: ["style-loader", "css-loader"],
      },
    ],
  },

  node: {
    fs: "empty",
  },

  mode: "production",

  optimization: {
    minimizer: [
      new TerserWebpackPlugin({
        sourceMap: true,
      }),
    ],
    splitChunks: {
      chunks: "all",
    },
  },

  devtool: "source-map",

  output: {
    path: path.resolve(__dirname, "./dist"),
    filename: "app.[hash:8].js",
    sourceMapFilename: "[name].js.map",
    publicPath: "/static/",
  },

  plugins: [
    new webpack.DefinePlugin({
      "process.env.NODE_ENV": JSON.stringify("production"),
    }),

    new HTMLPlugin({
      filename: "index.html",
      title: "Virtool",
      favicon: "./src/images/favicon.ico",
      template: "./src/index.html",
      inject: "body",
    }),

    new CleanWebpackPlugin(),
  ],
};
