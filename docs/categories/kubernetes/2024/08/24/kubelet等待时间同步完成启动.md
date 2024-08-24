---
title: kubelet等待时间同步完成启动
date: 2024-08-24 08:00:00
categories: 
  - kubernetes
tags:
  - chrony
  - ntp
  - kubelet
  - systemd
---
# 时间问题处理
很多依赖时间的业务在时间还未同步完成时启动了，导致数据异常，这里记录一下时间问题的处理方法。
## 保证容器在启动时时间已经同步完成
通过配置`kubelet`的`systemd`服务，使`kubelet`在启动时等待时间同步完成。
```bash
[Unit]
Description=kubelet: The Kubernetes Node Agent
Documentation=https://kubernetes.io/docs/
Wants=network-online.target chronyd.service
After=network-online.target chronyd.service

[Service]
ExecStart=/usr/bin/kubelet
Restart=always
StartLimitInterval=0
RestartSec=10

[Install]
WantedBy=multi-user.target
```
