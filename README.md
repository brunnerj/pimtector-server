# pimtector-server

This is the control system that gets deployed to a PIMtector receiver.

### ble-server

Provides support for BLE (bluetooth low energy) I/O to read device
information and battery level as well as the receiver values.

### standby-monitor

Provides support for the initialization system that controls
the (blue) status LED and power on/off button monitoring.

## Installing onto a PIMtector Receiver

1. ssh into the receiver  

    ```sh
    $ ssh root@<reciver-ip-address>
   ```

2. clone this repository

    ```sh
    $ git clone git@github.com:brunnerj/pimtector-server.git
    ```

3. install the modules (to `root` home directory)

    ```sh
    $ cd pimtector-server
    $ npm install
    ```

4. install the service

    ```sh
    $ ls -al standby* # ensure standby-monitor and standby-monitor.js are executable
    $ cp standby-monitor /etc/init.d/
    $ update-rc.d standby-monitor defaults
    ```

## Notes 

* standby-monitor

  - using the `/etc/init.d` startup method
  - power button must be held for 1 second to trigger halt (watch status LED for blinks)
  - press power button to wake system from halt (watch status LED to light)