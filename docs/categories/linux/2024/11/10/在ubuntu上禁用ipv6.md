---
title: 在ubuntu上禁用ipv6
date: 2024-11-10 00:00:00
author: yufeng
categories: 
  - linux
tags:
  - ipv6
  - ubuntu
---
# 在ubuntu上禁用ipv6
现在部分客户使用的操作系统从centos切换为ubuntu，有些开发组件会尝试解析ipv6地址，一些存储节点也是需要关闭ipv6的，所以我们需要在ubuntu上禁用ipv6。
## 临时关闭(不推荐)
只能临时禁用系统重启后会恢复
```shell
sudo sysctl -w net.ipv6.conf.all.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.default.disable_ipv6=1
sudo sysctl -w net.ipv6.conf.lo.disable_ipv6=1
```
添加以下内容到/etc/sysctl.conf文件中，效果一样
```shell
net.ipv6.conf.all.disable_ipv6=1
net.ipv6.conf.default.disable_ipv6=1
net.ipv6.conf.lo.disable_ipv6=1
```
sysctl -p 使配置生效
## 永久关闭
通过配置内核参数来永久关闭ipv6，编辑/etc/default/grub
```shell
GRUB_CMDLINE_LINUX_DEFAULT="quiet splash ipv6.disable=1"
GRUB_CMDLINE_LINUX="ipv6.disable=1"
```
**更新grub**!!!
```shell
sudo update-grub
```