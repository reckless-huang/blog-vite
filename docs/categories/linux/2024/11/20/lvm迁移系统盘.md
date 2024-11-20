---
title: lvm迁移系统盘
date: 2024-11-20 00:00:00
original: false
articleLink: 来自同事的分享
categories:
  - linux
tags:
  - lvm
  - 系统盘
  - 迁移
---
# lvm迁移系统盘
::: tip
同事做的分享，我觉得很棒，记录一下。
:::
将/dev/sylink/root的80G从旧盘移动到新盘

sda3为旧盘，sdb1为新盘

```plain
[root@master193 ~]# pvscan
  PV /dev/sda3   VG sylink          lvm2 [<99.50 GiB / 0    free]
  PV /dev/sdb1   VG sylink          lvm2 [<100.00 GiB / <100.00 GiB free]

[root@master193 ~]# lvscan
  ACTIVE            '/dev/sylink/data' [<19.50 GiB] inherit
  ACTIVE            '/dev/sylink/root' [80.00 GiB] inherit
```

# 镜像到新pv
lvconvert --type mirror -m 1 /dev/sylink/root /dev/sdb1

```plain
[root@master193 ~]# lvdisplay /dev/sylink/root
  --- Logical volume ---
  LV Path                /dev/sylink/root
  LV Name                root
  VG Name                sylink
  LV UUID                eTwRSu-WDbm-KjDq-jwLR-s1Gc-b8ks-lHFB36
  LV Write Access        read/write
  LV Creation host, time localhost, 2023-03-31 18:49:40 +0800
  LV Status              available
  # open                 1
  LV Size                80.00 GiB
  Current LE             20480
  Segments               1
  Allocation             inherit
  Read ahead sectors     auto
  - currently set to     8192
  Block device           253:0
  
  [root@master193 ~]# lvconvert --type mirror -m 1 /dev/sylink/root  /dev/sdb1
  Logical volume sylink/root being converted.
  sylink/root: Converted: 0.12%
  sylink/root: Converted: 1.58%
  sylink/root: Converted: 4.43%
  sylink/root: Converted: 12.61%
  sylink/root: Converted: 21.03%
  sylink/root: Converted: 26.09%
  sylink/root: Converted: 31.90%
  sylink/root: Converted: 39.99%
  sylink/root: Converted: 47.80%
  sylink/root: Converted: 51.71%
  sylink/root: Converted: 53.77%
  sylink/root: Converted: 56.97%
  sylink/root: Converted: 65.02%
  sylink/root: Converted: 73.40%
  sylink/root: Converted: 76.80%
  sylink/root: Converted: 84.40%
  sylink/root: Converted: 92.87%
  sylink/root: Converted: 100.00%
[root@master193 ~]# lvdisplay /dev/sylink/root
  --- Logical volume ---
  LV Path                /dev/sylink/root
  LV Name                root
  VG Name                sylink
  LV UUID                eTwRSu-WDbm-KjDq-jwLR-s1Gc-b8ks-lHFB36
  LV Write Access        read/write
  LV Creation host, time localhost, 2023-03-31 18:49:40 +0800
  LV Status              available
  # open                 1
  LV Size                80.00 GiB
  Current LE             20480
  Mirrored volumes       2
  Segments               1
  Allocation             inherit
  Read ahead sectors     auto
  - currently set to     8192
  Block device           253:0
```

# 移除旧pv
lvconvert --type mirror -m 0 /dev/sylink/root /dev/sda3

```plain
[root@master193 ~]# lvconvert --type mirror -m 0 /dev/sylink/root  /dev/sda3
  Logical volume sylink/root converted.
[root@master193 ~]# lvdisplay /dev/sylink/root
  --- Logical volume ---
  LV Path                /dev/sylink/root
  LV Name                root
  VG Name                sylink
  LV UUID                eTwRSu-WDbm-KjDq-jwLR-s1Gc-b8ks-lHFB36
  LV Write Access        read/write
  LV Creation host, time localhost, 2023-03-31 18:49:40 +0800
  LV Status              available
  # open                 1
  LV Size                80.00 GiB
  Current LE             20480
  Segments               1
  Allocation             inherit
  Read ahead sectors     auto
  - currently set to     8192
  Block device           253:0
   
   
[root@master193 ~]# pvscan
  PV /dev/sda3   VG sylink          lvm2 [<99.50 GiB / 80.00 GiB free]
  PV /dev/sdb1   VG sylink          lvm2 [<100.00 GiB / <20.00 GiB free]
  Total: 2 [199.49 GiB] / in use: 2 [199.49 GiB] / in no VG: 0 [0   ]
```

# efi引导相关数据迁移
```plain
Model: VMware Virtual disk (scsi)
Disk /dev/sda: 107GB
Sector size (logical/physical): 512B/512B
Partition Table: msdos
Disk Flags: 

Number  Start   End     Size    Type     File system  标志
 1      1049kB  3146kB  2097kB  primary
 2      3146kB  540MB   537MB   primary  ext4         启动
 3      540MB   107GB   107GB   primary               lvm
```

## 克隆分区
```plain
(parted) mkpart efi fat32 0% 200M                                        
(parted) mkpart boot ext4 200M 700M
(parted) p

Number  Start   End     Size    File system  Name  标志
 1      1049kB  200MB   199MB                efi
 2      200MB   700MB   500MB                boot

[root@master193 boot]# yum install dosfstool
[root@master193 boot]# mkfs -t vfat /dev/sdc1
[root@master193 boot]# mkfs -t ext4 /dev/sdc2

[root@master193 mnt]# mkdir /mnt/efi /mnt/boot
[root@master193 mnt]# mount /dev/sdc1 /mnt/efi
[root@master193 mnt]# mount /dev/sdc2 /mnt/boot

[root@master193 mnt]# cp -a /boot/efi/* /mnt/efi/
[root@master193 mnt]# cp -a /boot/* /mnt/boot/
```

```plain
blkid

/dev/sdc1: SEC_TYPE="msdos" UUID="67AE-DDE2" TYPE="vfat" PARTLABEL="efi" PARTUUID="52d37b08-52f0-4b9b-b119-85cd62bfd4bc" 
/dev/sdc2: UUID="4b457045-b631-4505-962a-768ac1e11b06" TYPE="ext4" PARTLABEL="boot" PARTUUID="5077841b-886e-4623-ba9b-719726a6b318"
```

## Fstab
更新到新建分区的uuid

```plain
UUID=4b457045-b631-4505-962a-768ac1e11b06 /boot                   ext4    defaults        1 2
UUID=67AE-DDE2          /boot/efi               vfat    umask=0077,shortname=winnt 0 0
```

## grub
### 获取新建boot分区的uuid
```plain
blkid
/dev/sda2: LABEL="boot" UUID="32ec2dec-ab37-4122-aaa7-a8d7d209cd80" TYPE="ext4"
```

### 更新/boot/grub.cfg
替换原/boot分区的uuid为新的

```plain
[root@master193 centos]# grep ecd5ce8 /boot/efi/EFI/centos/grub.cfg
          search --no-floppy --fs-uuid --set=root --hint-bios=hd0,gpt2 --hint-efi=hd0,gpt2 --hint-baremetal=ahci0,gpt2  ecd5ce83-a87f-4602-9c6a-9e07043c4d47
          search --no-floppy --fs-uuid --set=root ecd5ce83-a87f-4602-9c6a-9e07043c4d47
          search --no-floppy --fs-uuid --set=root --hint-bios=hd0,gpt2 --hint-efi=hd0,gpt2 --hint-baremetal=ahci0,gpt2  ecd5ce83-a87f-4602-9c6a-9e07043c4d47
          search --no-floppy --fs-uuid --set=root ecd5ce83-a87f-4602-9c6a-9e07043c4d47
          search --no-floppy --fs-uuid --set=root --hint-bios=hd0,gpt2 --hint-efi=hd0,gpt2 --hint-baremetal=ahci0,gpt2  ecd5ce83-a87f-4602-9c6a-9e07043c4d47
          search --no-floppy --fs-uuid --set=root ecd5ce83-a87f-4602-9c6a-9e07043c4d47
```

# 添加EFI引导选项
查看当前引导选项

```plain
[root@node192 ~]# efibootmgr -v
BootCurrent: 0000
Timeout: 1 seconds
BootOrder: 0000,0001,0002,0003
Boot0000* CentOS        HD(1,GPT,28ba70f2-dcd1-406a-9261-a5eadf0f4b18,0x800,0x64000)/File(\EFI\centos\shimx64.efi)
Boot0001* CD/DVD Rom    VenHw(b2ad3248-4f72-4950-a966-cfe5062db83a,02000000)
Boot0002* Hard Disk     VenHw(b2ad3248-4f72-4950-a966-cfe5062db83a,01000000)
Boot0003* Network       VenHw(b2ad3248-4f72-4950-a966-cfe5062db83a,05000000)
MirroredPercentageAbove4G: 0.00
MirrorMemoryBelow4GB: false
```

根据Boot0000信息创建基于sdb的引导选项

```plain
efibootmgr -c -w -L "CentosSSD" -d /dev/sdb -p 1 -l \\EFI\\centos\\shimx64.efi
```

确认是否添加成功，确保在BootOrder第一位

```plain
[root@node192 ~]# efibootmgr -v
BootCurrent: 0000
Timeout: 1 seconds
BootOrder: 0004,0000,0001,0002,0003
Boot0000* CentOS        HD(1,GPT,28ba70f2-dcd1-406a-9261-a5eadf0f4b18,0x800,0x64000)/File(\EFI\centos\shimx64.efi)
Boot0001* CD/DVD Rom    VenHw(b2ad3248-4f72-4950-a966-cfe5062db83a,02000000)
Boot0002* Hard Disk     VenHw(b2ad3248-4f72-4950-a966-cfe5062db83a,01000000)
Boot0003* Network       VenHw(b2ad3248-4f72-4950-a966-cfe5062db83a,05000000)
Boot0004* CentosSSD     HD(2,GPT,646c7bd1-9963-437f-9039-b2b26bedc858,0x5f800,0xee800)/File(\EFI\centos\shimx64.efi)
MirroredPercentageAbove4G: 0.00
MirrorMemoryBelow4GB: false
```

