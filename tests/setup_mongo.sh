#!/bin/bash
set -e

echo "Initializing MongoDB replica set..."

# Wait for MongoDB to be ready
until mongosh --quiet --eval "db.adminCommand('ping')" >/dev/null 2>&1; do
  sleep 1
done

# Initialize replica set with mongo hostname
mongosh --quiet --eval "
try {
  rs.initiate({
    _id: 'virtool',
    members: [
      { _id: 0, host: 'mongo:27017' }
    ]
  });
  print('Replica set initialized successfully');
} catch (e) {
  if (e.code === 23) {
    print('Replica set already initialized');
  } else {
    throw e;
  }
}
"

# Wait for replica set to be ready
echo "Waiting for replica set to be ready..."
until mongosh --quiet --eval "rs.isMaster().ismaster" | grep -q true; do
  sleep 1
done

# Create root user
echo "Creating root user..."
mongosh admin --quiet --eval "
try {
  db.createUser({
    user: 'root',
    pwd: 'virtool',
    roles: [ { role: 'root', db: 'admin' } ]
  });
  print('Root user created successfully');
} catch (e) {
  if (e.code === 51003) {
    print('Root user already exists');
  } else {
    throw e;
  }
}
"

echo "MongoDB replica set setup complete!"