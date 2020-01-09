# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_get_db[uvloop-False-False-None] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-False-False-auth_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-False-False-connection_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-False-False-name_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-False-True-None] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-False-True-auth_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-False-True-connection_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-False-True-name_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-True-False-None] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'mongodb://www.example.com:27017\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'foo\'>
                            </div>






                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-True-False-auth_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'mongodb://www.example.com:27017\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'foo\'>
                            </div>

                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong> Authentication failed.</strong>
                            </div>





                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-True-False-connection_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'mongodb://www.example.com:27017\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'foo\'>
                            </div>


                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong> Could not connect to MongoDB.</strong>
                            </div>




                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-True-False-name_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'mongodb://www.example.com:27017\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'foo\'>
                            </div>




                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong> Database names may not contain spaces or any of the following: </strong>
                                <code>/\\."$</code>.
                            </div>


                            <div class="setup-footer">
                                <div class="row">
                                    <div class="col-xs-12 col-sm-9">
                                        <a href="https://docs.mongodb.com/manual/reference/connection-string/">
                                            <i class="fas fa-question-circle"></i> Read more about MongoDB connection strings
                                        </a>
                                    </div>
                                    <div class="col-xs-12 col-sm-3">
                                        <button type="submit" class="btn btn-primary pull-right">
                                            <i class="fas fa-plug"></i> Connect
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </form>

                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-True-True-None] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'mongodb://www.example.com:27017\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'foo\'>
                            </div>





                            <div class="alert alert-success">
                                <i class="fas fa-check-circle"></i>
                                <strong> Database connection successful!</strong>
                            </div>

                        </form>

                        <div class="setup-footer">
                            <div class="row">
                                <div class="col-xs-12">
                                    <a href="/setup/data" class="btn btn-primary pull-right">
                                        <i class="fas fa-arrow-circle-right"></i> Next
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-True-True-auth_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'mongodb://www.example.com:27017\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'foo\'>
                            </div>

                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong> Authentication failed.</strong>
                            </div>




                            <div class="alert alert-success">
                                <i class="fas fa-check-circle"></i>
                                <strong> Database connection successful!</strong>
                            </div>

                        </form>

                        <div class="setup-footer">
                            <div class="row">
                                <div class="col-xs-12">
                                    <a href="/setup/data" class="btn btn-primary pull-right">
                                        <i class="fas fa-arrow-circle-right"></i> Next
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-True-True-connection_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'mongodb://www.example.com:27017\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'foo\'>
                            </div>


                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong> Could not connect to MongoDB.</strong>
                            </div>



                            <div class="alert alert-success">
                                <i class="fas fa-check-circle"></i>
                                <strong> Database connection successful!</strong>
                            </div>

                        </form>

                        <div class="setup-footer">
                            <div class="row">
                                <div class="col-xs-12">
                                    <a href="/setup/data" class="btn btn-primary pull-right">
                                        <i class="fas fa-arrow-circle-right"></i> Next
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_db[uvloop-True-True-name_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup DB - Virtool</title>
</head>

<body>
    <div class="container-noside">
        <div class="row">
            <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
                <div class="list-group">
                    <div class="list-group-item spaced clearfix">
                        <h4 class="setup-header">
                            Database
                        </h4>

                        <p class="setup-subheader text-muted">
                            Connect to MongoDB using connection string and database name.
                        </p>

                        <form method="POST" action="/setup/db">
                            <div class="form-group">
                                <label for="db_connection_string">Connection String</label>
                                <input type="text" class="form-control" name="db_connection_string" placeholder="mongodb://localhost:27017" id="db_connection_string" value=\'mongodb://www.example.com:27017\'>
                            </div>

                            <div class="form-group">
                                <label for="db_name">Database Name</label>
                                <input type="text" class="form-control" name="db_name" id="db_name" placeholder="virtool" value=\'foo\'>
                            </div>




                            <div class="alert alert-danger">
                                <i class="fas fa-exclamation-triangle"></i>
                                <strong> Database names may not contain spaces or any of the following: </strong>
                                <code>/\\."$</code>.
                            </div>

                            <div class="alert alert-success">
                                <i class="fas fa-check-circle"></i>
                                <strong> Database connection successful!</strong>
                            </div>

                        </form>

                        <div class="setup-footer">
                            <div class="row">
                                <div class="col-xs-12">
                                    <a href="/setup/data" class="btn btn-primary pull-right">
                                        <i class="fas fa-arrow-circle-right"></i> Next
                                    </a>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-/foo/bar-False-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-/foo/bar-False-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-/foo/bar-False-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'/foo/bar\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-/foo/bar-False-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'/foo/bar\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-/foo/bar-True-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-/foo/bar-True-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-/foo/bar-True-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'/foo/bar\'>
                        </div>




                        <div class="alert alert-success">
                            <i class="fas fa-checkmark-circle"></i>
                            <strong> Path is available an will be configured when setup is complete.</strong>
                        </div>

                        <div class="setup-footer">
                            <a href="/setup/watch" class="btn btn-primary pull-right">
                                <i class="fas fa-arrow-circle-right"></i> Next
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-/foo/bar-True-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'/foo/bar\'>
                        </div>




                        <div class="alert alert-success">
                            <i class="fas fa-checkmark-circle"></i>
                            <strong> Path is available an will be configured when setup is complete.</strong>
                        </div>

                        <div class="setup-footer">
                            <a href="/setup/finish" class="btn btn-primary pull-right">
                                <i class="fas fa-arrow-circle-right"></i> Next
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-False-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-False-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-False-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-False-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-True-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-True-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-True-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'\'>
                        </div>




                        <div class="alert alert-success">
                            <i class="fas fa-checkmark-circle"></i>
                            <strong> Path is available an will be configured when setup is complete.</strong>
                        </div>

                        <div class="setup-footer">
                            <a href="/setup/watch" class="btn btn-primary pull-right">
                                <i class="fas fa-arrow-circle-right"></i> Next
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-True-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'\'>
                        </div>




                        <div class="alert alert-success">
                            <i class="fas fa-checkmark-circle"></i>
                            <strong> Path is available an will be configured when setup is complete.</strong>
                        </div>

                        <div class="setup-footer">
                            <a href="/setup/finish" class="btn btn-primary pull-right">
                                <i class="fas fa-arrow-circle-right"></i> Next
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-foo-False-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-foo-False-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-foo-False-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'foo\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-foo-False-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'foo\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-foo-True-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-foo-True-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'\'>
                        </div>





                        <div class="setup-footer">
                            <button type="submit" class="btn btn-primary pull-right">
                                <i class="fas fa-save"></i> Save
                            </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-foo-True-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        data Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool will store application data (<em>eg</em>. sample files) at this location.
                    </p>

                    <form method="POST" action="/setup/data">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="data" value=\'foo\'>
                        </div>




                        <div class="alert alert-success">
                            <i class="fas fa-checkmark-circle"></i>
                            <strong> Path is available an will be configured when setup is complete.</strong>
                        </div>

                        <div class="setup-footer">
                            <a href="/setup/watch" class="btn btn-primary pull-right">
                                <i class="fas fa-arrow-circle-right"></i> Next
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''

snapshots['test_get_paths[uvloop-foo-True-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8">
    <meta http-equiv="X-UA-Compatible" content="IE=edge">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="shortcut icon" href="/static/favicon.ico?v=2" type="images/x-icon"/>
    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.11/css/all.css" integrity="sha384-p2jx59pefphTFIpeqCcISO9MdVfIm4pNnsL08A6v5vaQc4owkQqxMV8kg4Yvhaw/" crossorigin="anonymous">
    <link rel="stylesheet" href="/static/main..css">

    <style nonce="foo1bar2baz3">
        .setup-header {
            margin-bottom: 20px;
        }
        .setup-footer {
            margin-top: 25px;
        }
    </style>

    <title>Setup - Virtool</title>
</head>

<body>
<div class="container-noside">
    <div class="row">
        <div class="col-xs-12 col-sm-8 col-sm-offset-2 col-lg-4 col-lg-offset-4">
            <div class="list-group">
                <div class="list-group-item spaced clearfix">
                    <h4 class="setup-header text-capitalize">
                        watch Location
                    </h4>

                    <p class="text-muted setup-subheader">
                            Virtool automatically retrieve read files from this location and make them available for
                            sample creation in the application.
                    </p>

                    <form method="POST" action="/setup/watch">
                        <div class="form-group">
                            <label for="path">Path</label>
                            <input type="text" class="form-control" name="path" id="path" placeholder="watch" value=\'foo\'>
                        </div>




                        <div class="alert alert-success">
                            <i class="fas fa-checkmark-circle"></i>
                            <strong> Path is available an will be configured when setup is complete.</strong>
                        </div>

                        <div class="setup-footer">
                            <a href="/setup/finish" class="btn btn-primary pull-right">
                                <i class="fas fa-arrow-circle-right"></i> Next
                            </a>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    </div>
</div>
</body>

</html>
'''
