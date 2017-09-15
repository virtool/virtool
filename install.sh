#!/usr/bin/env bash

SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"

echo $SCRIPT_DIR

if [[ $EUID -ne 0 ]]; then
	printf 'This install script must be run as root.%s\n%s\n'
	exit 1
fi

printf 'This script will install Virtool to a specified location,
setup an init.d script, and optionally a dedicated
Virtool user account.
Proceed? [y/N]
'

read PROCEED

if [ "$PROCEED" != 'Y' ] && [ "$PROCEED" != 'y' ]; then
    exit 1
fi

echo $INSTALL_PATH

printf 'Should Virtool be run as a custom user? [y/N]%s\n'

CUSTOM_USERNAME=''

read USE_CUSTOM_USER

if [ "$USE_CUSTOM_USER" == 'Y' ] || [ "$USE_CUSTOM_USER" == 'y' ]; then
    printf 'Define the name of the custom user.%s\n[virtool]%s\n'

	read CUSTOM_USERNAME

	if [ "$CUSTOM_USERNAME" == '' ]; then
		CUSTOM_USERNAME='virtool'
	fi
fi

DEFAULT_INSTALL_PATH=/opt/virtool

if [ "$CUSTOM_USERNAME" != '' ]; then
	DEFAULT_INSTALL_PATH=/home/${CUSTOM_USERNAME}/virtool
fi

printf "Where should Virtool be installed?%s\n[${DEFAULT_INSTALL_PATH}]%s\n"

read INSTALL_PATH

if [ "$INSTALL_PATH" == '' ]; then
	INSTALL_PATH=$DEFAULT_INSTALL_PATH
fi

printf 'Should an startup script for Virtool be added to /etc/init.d? [Y/n]%s\n'

read USE_INIT

if [ -d "$INSTALL_PATH" ]; then
	echo "Install path already exists. Will update Virtool."
else
	echo "Could not find install directory. Creating."
	mkdir -p $INSTALL_PATH
fi

echo "Copying files..."

cp -r $SCRIPT_DIR/* $INSTALL_PATH

OWNER='root'

if [ "$CUSTOM_USERNAME" != '' ]; then

    echo "Setting up custom user"


	if id "$CUSTOM_USERNAME" ; then
	    echo "Custom user already exists"
    else
        echo "Configuring custom user."
        useradd -mU ${CUSTOM_USERNAME}
    fi

	OWNER=${CUSTOM_USERNAME}
fi

if [ ! -d "/var/run/virtoold" ]; then
    mkdir /var/run/virtoold

    chown -R ${OWNER}:${OWNER} /var/run/virtoold
    chmod -R ug+rw /var/run/virtoold
fi

echo "Configuring permissions."

chown ${OWNER}:${OWNER} -R $INSTALL_PATH
chmod ugo+x ${INSTALL_PATH}/run
chmod ug+rw -R ${INSTALL_PATH}

if [ "$USE_INIT" != 'Y' ] || [ "$USE_INIT" != 'y' ]; then
    echo 'Setting up init script'

    sed "s@VTPATH@${INSTALL_PATH}@" ${INSTALL_PATH}/assets/virtoold.sh | sed "s/VTUSER/${CUSTOM_USERNAME}/" > /etc/init.d/virtoold

    chown root:root /etc/init.d/virtoold
    chmod ugo+x /etc/init.d/virtoold

    echo 'Setting up systemd server.'

    sed "s@VTPATH@${INSTALL_PATH}@" ${INSTALL_PATH}/assets/virtoold.service | sed "s/VTUSER/${CUSTOM_USERNAME}/" > /lib/systemd/system/virtoold.service

    chown root:root /etc/init.d/virtoold
    chmod ugo+x /etc/init.d/virtoold

    chown root:root /lib/systemd/system/virtoold.service
fi