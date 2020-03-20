Creating the PIMtector SDCard Image
=======

Currently using [DietPi](https://dietpi.com/) images

	TODO: write this section...



Cloning and Burning SDCard Images
-------

To clone an existing SDCard image to the desktop (on MacOS):

	1. Discover the mounted SDCard device

	   `$ diskutil list`  


	2. Compress the disk image (~8 GB) to desktop

	   `$ sudo dd if=/dev/rdisk4 bs=1m | pv -s 8G | gzip > /Users/username/Desktop/dietpi-VER-pimtector.img.gz`  


To put the cloned image onto a new SDCard (_assuming it mounts to the same device found above_):

	1. Unmount the SDCard (_this is NOT ejecting the mounted drive_)

		`$ diskutil unmountDisk /dev/disk4`  


	2. Get super user `root` access

		`$ sudo su`  


	3. Flash the SDCard with the image

		`$ gzip -dc /Users/username/Desktop/dietpi-VER-pimtector.img.gz | pv -s 8G | dd of=/dev/rdisk4 bs=1m`  
