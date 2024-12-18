---
title: 节点磁盘压力排查
date: 2023-12-18 20:00:00
author: yufeng
categories:
  - kubernetes
tags:
  - 磁盘压力
  - inode
  - 故障
---
# 节点磁盘压力排查
记录一次内部的故障，我们的saas有很多物联网卡，因此有一些面板用来巡检物联网卡的资费信息，但是某天这些面板都挂了，查询发现prometheus因为节点磁盘压力
被驱逐了。
## 问题分析
1. 查看节点磁盘使用情况
- 发现磁盘使用量是健康的
2. 难道是我们的清理脚本刚完成了清理？
- 查看历史的监控数据发现磁盘情况是一直稳定健康的
3. 一时有些没有思绪
4. 查看kubelet日志
```shell
Dec 17 14:08:06 node193.169.203.140 kubelet[1078]: I1217 06:08:06.038367    1078 eviction_manager.go:355] eviction manager: must evict pod(s) to reclaim inodes
```
日志提示是因为inode不够了
5. 查看节点的inode使用情况
```shell
/dev/mapper/ubuntu--vg-ubuntu--lv  26214400  24901392   1313008   95% /
```
果然，没有办法立刻定位异常的inode，先从vg中分配一些可用空间恢复节点先
6. 清理inode
## 复盘
1. 不要经验判断起手，从日志，监控数据，以及磁盘使用情况开始排查问题
2. inode的使用情况需要加入到监控中，方便排查
3. 此次过程中及时新增磁盘解决问题是值得夸赞的做法，先解决问题再做优化
