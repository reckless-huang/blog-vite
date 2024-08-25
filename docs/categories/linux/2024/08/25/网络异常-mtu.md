---
title: 网络异常-mtu
date: 2024-08-25 08:00:00
categories: 
  - linux
tags:
  - network
  - mtu
---
# 网络异常-mtu
同事反馈一个双网卡的客户环境在节后重启后出现某个节点无法访使用nodeport问集群内服务的问题，直接表现为使用节点ip+nodeport直接curl大概率无法访问产品主页，更换其他节点IP就可以正常访问了。   
## 排查
这里一开始就犯下了一个错误，通过curl卡主下意识判断为网络问题，而没注意到curl中网络问题应该要通过更准确的head方式探测，直接get请求可能存在其他原因导致的无法顺利收包。  
于是一开始的注意力都放在了安全组和kubeproxy上，结果自然是无功而返  
在确定curl -I 的head探测是成功后，就基本可以确定是body接收的问题了，查看网卡的状态发现有比较多的drop包，但是其他节点上也有很多的drop包，所以也不能第一时间作为差异点排查。但还是按照[网卡丢包的方式进行了排查]
(https://huaweicloud.csdn.net/6549f60334bf9e25c799c81d.html)   
由于节点没有外部网络perf，tcpdump工具都无法使用yum安装，因此也在同步进行离线安装，c++依赖太难处理了。
再继续对比网卡参数时发现该节点上的mtu值和其他节点不一致，节点上的配置为1300，正常节点为1500，虚拟网卡1300和主网卡的1500不匹配，问题大概就是这里了  
### 使用ping测试
坏的主机上ping 1272+28=1300 字节（28字节是ICMP协议的头大小）：  
```shell
docker run --rm -it nicolaka/netshoot:latest /bin/bash
> ping -c 3 -M do -s 1272 baidu.com
PING baidu.com (220.181.38.148) 1272(1300) bytes of data.
1430 bytes from 220.181.38.148 (220.181.38.148): icmp_seq=1 ttl=48 time=27.6 ms
```
可以看到结果正常，如果ping 1273+28=1301字节，就不行了：
```shell
> ping -c 3 -M do -s 1273 baidu.com
PING baidu.com (39.156.69.79) 1273(1301) bytes of data.
ping: local error: message too long, mtu=1300
```
这个就说明mtu最大只能是1300。
进入/sys/class/net/ens18/statistics/，逐个查看，发现是rx_length_errors的值比较大，这个值表示接收到的数据包长度不对，这个值比较大，说明有很多数据包被丢弃了。
### 网络插件启动日志
最后发现这个1300是客户在我们的服务器上安装了向日葵，向日葵创建的网卡mtu被设置为1300了，而我们的cni cilium没有手动设置mtu，在启动时加载了一段奇怪的逻辑，将1300作为mtu下发到了所有的lxc虚拟网卡
````
level=info msg="Inheriting MTU from external network interface" device=oray_vnc ipAddr=172.16.0.249 mtu=1300 subsys=mtu
````
修复向日葵的网卡，然后手动设置cilium mtu   
```yaml
args:
  - --mtu=1500
```
## 复盘
- 7层的检查最好是curl发送head请求检查，而不是ping
- 要对网卡参数配置了解的更加深入，对统计值的含义要有更深入的了解