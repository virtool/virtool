# Virtool

_Cloud Development Branch_

Virtool is a web-based application for diagnosing viral infections in plant samples using Illumina sequencing. 
  
Website: https://www.virtool.ca
Gitter: https://gitter.im/virtool

## Setup

1. Create a volume
   ```shell script
   docker volume create virtool
   ```

2. Run MongoDB 4.2+ and Redis 6.0+ and make accessible to Virtool containers.

## Run Server

```shell script
docker run -p 9950:9950 -v virtool:/vt/data igboyes/virtool:0.1.2 python run.py server --db-connection-string mongodb://10.0.0.221:27017 --db-name virtool --redis-connection-string redis://10.0.0.221:6379 --host 0.0.0.0 --data-path /vt/data
```

- mount volume and provide its path to Virtool through the `--data-path` option
- connect to previously started Redis and MongoDB servers

### Starting Jobs
When jobs are started on the server they are right-pushed into one of two lists:

- `jobs_lg`: large jobs requiring around 16 cores and 32 GB RAM
- `jobs_sm`: small jobs requiring around 4 cores and 8 GB RAM 

## Run Single Job

```shell script
docker run -v virtool:/vt/data igboyes/virtool:0.1.2 python run.py job --db-connection-string mongodb://10.0.0.221:27017 --db-name virtool --redis-connection-string redis://10.0.0.221:6379 --data-path /vt/data --proc 6 --mem 12 --job-id foobar
```

This will run a single workflow job given a job ID.

- provide the database connection information and `--data-path`
- provide the `--job-id` option to specifiy which job should be run
- use `--proc` and `--mem` to specify what resources are available for the job
 
 ## Run Job Agent
 
```shell script
docker run -v virtool:/vt/data igboyes/virtool:0.1.2 python run.py agent --db-connection-string mongodb://10.0.0.221:27017 --db-name virtool --redis-connection-string redis://10.0.0.221:6379 --data-path /vt/data --proc 6 --mem 12 --lg-proc 6 --lg-mem 12 --sm-proc 2 --sm-mem 4
```

This will run a service that watches Redis for jobs and starts them using `subprocess`. It will keep track of the resource usage of the running jobs.

- provide the database and Redis connection parameters
- provide the resource options that tell the agent its overall limits and the per-job limits for `lg` and `sm` job sizes