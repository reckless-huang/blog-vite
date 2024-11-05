---
title: 重启服务器后kubelet无法启动
date: 2024-11-05 00:00:00
categories:
  - kubernetes
tags:
  - kubelet
  - 重启
  - 故障
---
# 重启服务器后kubelet无法启动
随着我们功能的不断增加，会出现客户现有的服务器资源不足，需要增加硬件资源，往往会重启服务器，这次重启后发现kubelet无法启动，这里记录一下解决过程。
## 问题
查看kubelet日志发现如下错误：
```shell
Streaming server stopped unexpectedly: listen tcp 192.168.11.4:0; biind: cannot assign requested address
```
## 排查
异常主机IP不是11.4而是11.2，因此首先怀疑配置文件中的IP地址有问题，依次查看了
- /var/lib/kubelet/kubeadm-flags.env
- /var/lib/kubelet/config.yaml
都没发现异常IP地址。已经有点摸不着头脑了，这个IP地址是哪里来的呢？又是一顿排查，最后突然想到有没有可能是localhost的解析出现了问题，查看了/etc/hosts文件，果然发现了异常。
```shell
192.168.11.4 master192.168.11.4::1 localhost loopback
```
备份现场，修改/etc/hosts文件，重启kubelet，问题解决。
## 复盘
1. 对kubelet监听启动的过程了解的不够深入，导致排查问题的时候走了很多弯路。
2. 对服务器关键的配置文件最好有巡检机制，避免类似问题再次发生。