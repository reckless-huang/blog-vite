---
title: Pulsar监控错误
isOriginal: true
author: 宇峰
date: 2024/08/16 22:25
categories:
  - linux
tags:
  - pulsar
  - prometheus
  - utf8
---
# 记录一次Pulsar监控错误
在一次定版后我们的不少客户陆续出现了PulsarBroker异常的告警，直觉告诉我们这是一个被广播的故障，需要立刻排查。
## 排查prometheus监控链路
通过对prometheus指标的排查，我们发现在prometheus中broker的endpoint直接down了，显示错误为**invalid UTF-8 label value**
## 直接查询metrics接口,排查数据问题
通过curl转存了metrics数据，但是如何定位数据中的非法字符呢，指标太大了，我们需要一个工具来帮助我们排查。   
shell来帮忙
```shell
grep -axv '.*' FILE
```
这个命令可以帮助我们排查文件中的非法字符，我们可以通过这个命令来排查metrics数据中的非法字符。  
原来是一个中文的订阅者名称导致的，但是我们的订阅者是不会下线的，如何手动下线这个订阅者呢？   
## 如何下线中文订阅者
一开始尝试在pulsar的tool工具pod中使用pulsar-admin命令下线订阅者，但是发现pulsar-admin命令不支持中文。   
于是我们尝试使用zk直接删除订阅者节点，节点是删除了，但是订阅者还是存在，导致我们的业务工程重启反而错误了，即使重启业务工程也无法恢复订阅，还好是在测试环境  
会不会是pod shell环境的问题呢，尝试在本地使用pulsar-admin命令下线订阅者，居然直接成功了，果然是podshell环境的问题。
```shell
./bin/pulsar-admin --admin-url xxxxx topics unsubscribe -s "中文topic" persistent://xxxx
```
## 复盘
- 监控告警应当区分endpoint down的情况
- 业务工程的订阅者名称不要使用中文
- pod shell环境可能对中文支持不好
## 参考文章
- [如何从文件中删除非UTF-8字符](https://www.itcodingman.com/remove_non_utf_8_characters/)