#!/bin/bash

### BEGIN INIT INFO
# Provides:          virtoold
# Required-Start:    mongod
# Required-Stop:     mongod
# Default-Start:     2 3 4 5
# Default-Stop:      0 1 6
# Short-Description: Starts the Virtool service.
# Description:       Starts the Virtool service.
### END INIT INFO

# Using the lsb functions to perform the operations.
. /lib/lsb/init-functions

# Process name
NAME=virtool

# Where is the executable?
DAEMON=VTPATH/run

# PID file for the daemon.
PIDFILE=/var/run/virtoold/virtoold.pid

# Exit if the executable is not there.
test -x $DAEMON || exit 5

case $1 in
    start)

        if start-stop-daemon --chuid VTUSER --chdir VTPATH --start --background --quiet --oknodo --pidfile $PIDFILE --exec $DAEMON; then
            log_end_msg 0
        else
            log_end_msg 1
        fi
    ;;

    stop)
        echo $USER

        if [ -e $PIDFILE ]; then
            start-stop-daemon --stop --quiet --oknodo --pidfile $PIDFILE
            rm -rf $PIDFILE
        else
            log_daemon_msg "$NAME is not running"
            log_end_msg 0
        fi
    ;;

    restart)
        $0 stop && sleep 2 && $0 start
    ;;

    status)

        if [ -e $PIDFILE ]; then
            status_of_proc -p $PIDFILE $DAEMON "$NAME process" && exit 0 || exit $?
        else
            log_daemon_msg "$NAME is not running"
            log_end_msg 0
        fi
    ;;

    reload)
        log_failure_msg 'Reload is not implemented for Virtool'
    ;;

    *)
        echo "Usage: $0 {start|stop|restart|reload|status}"
        exit 2
    ;;
esac