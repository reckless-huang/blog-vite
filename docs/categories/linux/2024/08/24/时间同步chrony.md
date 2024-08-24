---
title: 时间同步chrony
date: 2024-08-24 08:00:00
categories: 
  - linux
tags:
  - chrony
  - ntp
  - makestep
  - initstepslew
---
# 在linux上配置时间同步
在很多集群工作模式的系统中，时间同步是非常重要的，否则会导致很多问题，比如证书无法验证，日志无法对齐等，但是传统的ntp服务存在时间差过大时无法同步的问题，chrony提供了一些配置可以更快的同步时间。
# 直接上我们的生产配置文件
```bash
# cat /etc/chrony.conf
# Use public servers from the pool.ntp.org project.
# Please consider joining the pool (http://www.pool.ntp.org/join.html).
server ntp.aliyun.com iburst prefer
server 203.107.6.88 iburst prefer

server time.windows.com iburst
server 52.231.114.183 iburst

server time.apple.com iburst
server 17.253.116.125 iburst

server cn.ntp.org.cn iburst
server 106.75.185.63 iburst

server {{ vip }} iburst

# Record the rate at which the system clock gains/losses time.
driftfile /var/lib/chrony/drift

# Allow the system clock to be stepped in the first three updates
# if its offset is larger than 1 second.
makestep 1.0 3
initstepslew 30 ntp.aliyun.com time.windows.com time.apple.com cn.ntp.org.cn 203.107.6.88 52.231.114.183 17.253.116.125 106.75.185.63 {{ vip }}

# Enable kernel synchronization of the real-time clock (RTC).
rtcsync

# Enable hardware timestamping on all interfaces that support it.
#hwtimestamp *

# Increase the minimum number of selectable sources required to adjust
# the system clock.
#minsources 2

# Allow NTP client access from local network.
allow 0.0.0.0/0

# Serve time even if not synchronized to a time source.
local stratum 10

# Specify file containing keys for NTP authentication.
#keyfile /etc/chrony.keys

# Specify directory for log files.
logdir /var/log/chrony

# Select which information is logged.
#log measurements statistics tracking
```
## 关键配置
### initstepslew   
initstepslew 指令在功能上类似于 makestep 和 server 指令与 iburst 选项的组合。主要区别在于 initstepslew 服务器只被使用 在正常操作开始之前，并且前台 chronyd 进程等待 让 initstepslew 在退出之前完成。这对于**阻止**程序 在 chronyd 之后的启动序列中启动，从读取它之前的时钟开始 已被阶梯化。
### makestep
makestep 用于 chronyd 运行期间，当检测到时间偏差超过一定阈值时，允许 chronyd 通过步进（而不是逐渐调整）来立即同步时间
### 区别
- makestep 用于 chronyd 运行期间，当检测到时间偏差超过一定阈值时，允许 chronyd 通过步进（而不是逐渐调整）来立即同步时间
- initstepslew 用于 chronyd 启动期间，当检测到时间偏差超过一定阈值时，允许 chronyd 通过步进（而不是逐渐调整）来立即同步时间
- initstepslew仅适用于ntp源，而makestep适用于ntp源和本地时钟
## 参考文章
- [详解ntp和chrony](https://blog.csdn.net/wangjie72270/article/details/122196213)
- [chrony官方文档](https://chrony-project.org/doc/3.5/chrony.conf.html)