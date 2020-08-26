# -*- coding: utf-8 -*-
# snapshottest: v1 - https://goo.gl/zC4yUc
from __future__ import unicode_literals

from snapshottest import Snapshot


snapshots = Snapshot()

snapshots['test_get_db[uvloop-False-False-None] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value=''
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value=''
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-False-False-auth_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value=''
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value=''
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-False-False-connection_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value=''
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value=''
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-False-False-name_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value=''
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value=''
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-False-True-None] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value=''
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value=''
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-False-True-auth_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value=''
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value=''
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-False-True-connection_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value=''
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value=''
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-False-True-name_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value=''
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value=''
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-True-False-None] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value='mongodb://www.example.com:27017'
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value='foo'
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-True-False-auth_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value='mongodb://www.example.com:27017'
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value='foo'
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
    
    <div class="setup-error">
      <i class="fas fa-exclamation-triangle"></i>
      <strong> Authentication failed.</strong>
    </div>
         
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-True-False-connection_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value='mongodb://www.example.com:27017'
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value='foo'
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
     
    <div class="setup-error">
      <i class="fas fa-exclamation-triangle"></i>
      <strong> Could not connect to MongoDB.</strong>
    </div>
        
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-True-False-name_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value='mongodb://www.example.com:27017'
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value='foo'
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
       
    <div class="setup-error">
      <i class="fas fa-exclamation-triangle"></i>
      <strong>
        Database names may not contain spaces or any of the following:
      </strong>
      <code>/\\."$</code>.
    </div>
      
    <div>
      <button type="submit" class="button">
        <i class="fas fa-plug"></i> Connect
      </button>
    </div>
    
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-True-True-None] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value='mongodb://www.example.com:27017'
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value='foo'
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
        
    <div class="setup-success">
      <i class="fas fa-check-circle"></i>
      <strong> Database connection successful!</strong>
    </div>
    <div>
      <a href="/setup/data" class="button button-plain">
        <i class="fas fa-arrow-circle-right"></i> Next
      </a>
    </div>
     
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-True-True-auth_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value='mongodb://www.example.com:27017'
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value='foo'
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
    
    <div class="setup-error">
      <i class="fas fa-exclamation-triangle"></i>
      <strong> Authentication failed.</strong>
    </div>
        
    <div class="setup-success">
      <i class="fas fa-check-circle"></i>
      <strong> Database connection successful!</strong>
    </div>
    <div>
      <a href="/setup/data" class="button button-plain">
        <i class="fas fa-arrow-circle-right"></i> Next
      </a>
    </div>
     
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-True-True-connection_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value='mongodb://www.example.com:27017'
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value='foo'
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
     
    <div class="setup-error">
      <i class="fas fa-exclamation-triangle"></i>
      <strong> Could not connect to MongoDB.</strong>
    </div>
       
    <div class="setup-success">
      <i class="fas fa-check-circle"></i>
      <strong> Database connection successful!</strong>
    </div>
    <div>
      <a href="/setup/data" class="button button-plain">
        <i class="fas fa-arrow-circle-right"></i> Next
      </a>
    </div>
     
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_db[uvloop-True-True-name_error] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup DB - Virtool</title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
<h1>
  Database
</h1>

<p class="subtitle">
  Connect to MongoDB using connection string and database name.
</p>

<form method="POST" action="/setup/db">
  <label for="db_connection_string">Connection String</label>
  <input
    type="text"
    class="form-control"
    name="db_connection_string"
    placeholder="mongodb://localhost:27017"
    id="db_connection_string"
    value='mongodb://www.example.com:27017'
  />

  <label for="db_name">Database Name</label>
  <input
    type="text"
    class="form-control"
    name="db_name"
    id="db_name"
    placeholder="virtool"
    value='foo'
  />

  <a href="https://docs.mongodb.com/manual/reference/connection-string/">
    <i class="fas fa-question-circle"></i> Read more about MongoDB connection
    strings
  </a>

  <div class="setup-footer">
       
    <div class="setup-error">
      <i class="fas fa-exclamation-triangle"></i>
      <strong>
        Database names may not contain spaces or any of the following:
      </strong>
      <code>/\\."$</code>.
    </div>
     
    <div class="setup-success">
      <i class="fas fa-check-circle"></i>
      <strong> Database connection successful!</strong>
    </div>
    <div>
      <a href="/setup/data" class="button button-plain">
        <i class="fas fa-arrow-circle-right"></i> Next
      </a>
    </div>
     
  </div>
</form>


    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop--True-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value=''
        />

        <div class="setup-footer">
               
            <div class="setup-success">
                <i class="fas fa-checkmark-circle"></i>
                <strong>
                    Path is available an will be configured when setup is complete.</strong
                >
            </div>
        
            <div>
                
                    <a href="/setup/watch"
                       class="button button-plain">
                        <i class="fas fa-arrow-circle-right"></i> Next
                    </a>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop--True-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value=''
        />

        <div class="setup-footer">
               
            <div class="setup-success">
                <i class="fas fa-checkmark-circle"></i>
                <strong>
                    Path is available an will be configured when setup is complete.</strong
                >
            </div>
        
            <div>
                
                    <a href="/setup/finish"
                       class="button button-plain">
                        <i class="fas fa-arrow-circle-right"></i> Next
                    </a>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop--True-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop--True-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop--False-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop--False-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop--False-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop--False-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-foo-True-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value='foo'
        />

        <div class="setup-footer">
               
            <div class="setup-success">
                <i class="fas fa-checkmark-circle"></i>
                <strong>
                    Path is available an will be configured when setup is complete.</strong
                >
            </div>
        
            <div>
                
                    <a href="/setup/watch"
                       class="button button-plain">
                        <i class="fas fa-arrow-circle-right"></i> Next
                    </a>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-foo-True-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value='foo'
        />

        <div class="setup-footer">
               
            <div class="setup-success">
                <i class="fas fa-checkmark-circle"></i>
                <strong>
                    Path is available an will be configured when setup is complete.</strong
                >
            </div>
        
            <div>
                
                    <a href="/setup/finish"
                       class="button button-plain">
                        <i class="fas fa-arrow-circle-right"></i> Next
                    </a>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-foo-True-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-foo-True-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-foo-False-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value='foo'
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-foo-False-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value='foo'
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-foo-False-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-foo-False-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-/foo/bar-True-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value='/foo/bar'
        />

        <div class="setup-footer">
               
            <div class="setup-success">
                <i class="fas fa-checkmark-circle"></i>
                <strong>
                    Path is available an will be configured when setup is complete.</strong
                >
            </div>
        
            <div>
                
                    <a href="/setup/watch"
                       class="button button-plain">
                        <i class="fas fa-arrow-circle-right"></i> Next
                    </a>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-/foo/bar-True-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value='/foo/bar'
        />

        <div class="setup-footer">
               
            <div class="setup-success">
                <i class="fas fa-checkmark-circle"></i>
                <strong>
                    Path is available an will be configured when setup is complete.</strong
                >
            </div>
        
            <div>
                
                    <a href="/setup/finish"
                       class="button button-plain">
                        <i class="fas fa-arrow-circle-right"></i> Next
                    </a>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-/foo/bar-True-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-/foo/bar-True-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-/foo/bar-False-True-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value='/foo/bar'
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-/foo/bar-False-True-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value='/foo/bar'
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-/foo/bar-False-False-data] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Data Location
    </h1>

    <p class="subtitle">
        
            Virtool will store application data (<em>eg</em>. sample files) at this location.
        
    </p>

    <form method="POST" action="/setup/data">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="data"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''

snapshots['test_get_paths[uvloop-/foo/bar-False-False-watch] 1'] = '''<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="utf-8"/>
    <meta http-equiv="X-UA-Compatible" content="IE=edge"/>
    <meta name="viewport" content="width=device-width, initial-scale=1"/>
    <link
            rel="shortcut icon"
            href="/static/favicon.ico?v=2"
            type="images/x-icon"
    />
    <link
            rel="stylesheet"
            href="https://use.fontawesome.com/releases/v5.12.1/css/all.css"
    />
    <link
            href="https://fonts.googleapis.com/css2?family=Roboto+Mono&family=Roboto:ital,wght@0,400;0,500;0,700;1,400&display=swap"
            rel="stylesheet"
    />
    <link rel="stylesheet" href="/static/base.css"/>
    <link rel="stylesheet" href="/static/setup.css"/>

    <title>Setup - Virtool </title>
</head>

<body>
<div class="container">
    <div class="dialog">
        
    <h1>
        Watch Location
    </h1>

    <p class="subtitle">
        
            Virtool automatically retrieve sample read files from this location.
        
    </p>

    <form method="POST" action="/setup/watch">
        <label for="path">Path</label>
        <input
                type="text"
                class="form-control"
                name="path"
                id="path"
                placeholder="watch"
                value=''
        />

        <div class="setup-footer">
               
            <div>
                
                    <button type="submit" class="button">
                        <i class="fas fa-save"></i> Save
                    </button>
                
            </div>
        </div>
    </form>

    </div>
</div>
</body>
</html>'''
