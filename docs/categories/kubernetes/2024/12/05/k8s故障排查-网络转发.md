---
title: k8s故障排查-网络转发
data: 2024-12-05 19:05:05
author: yufeng
categories:
   - kubernetes
tags:
   - kubernetes
   - ipv4
---
# k8s故障排查-网络转发
最近一段时间我的工作内容偏向运维平台开发多一点，处理集群故障似乎有点生疏了，因此最近的一次故障我主动参与了进来。这里也作了一个简单的记录和复盘:blush
:
## 表象分析
同事反馈最开始因为客户操作将我们的vip绑定了到了服务器A的em2上，导致集群的keepalived异常，使用arp-ping查出问题后，禁用了em2网卡，keepalived
恢复正常，便没有继续处理了。由于是新客户的集群也没有在使用，所以到也风平浪静，直到测试同学测试时发现业务系统很多报错几乎无法正常工作，这时候检查集群
发现coredns和metric-server都处在loopback状态，还有很多业务pod也没有正常启动。ok开始分析：   
### 看日志
查看coredns和apiserver都有类似错误日志
```
E1204 11:07:19.168968       1 reflector.go:178] pkg/mod/k8s.io/client-go@v0.18.3/tools/cache/reflector.go:125: Failed to list *v1.Namespace: Get "https://100.158.0.1:443/api/v1/namespaces?limit=500&resourceVersion=0": dial tcp 100.158.0.1:443: i/o timeout
```
初步确定是pod内容无法访问api-server，在主机上测试
```
curl -k https://100.158.0.1:443
```
是正常访问的，说明是容器内的网络转发异常   
以上还算正常，但这之后我就开始靠所谓的经验猜问题了，在mtu ipv6 ipatbles上查了一个遍，也没定位到问题
## 头脑清醒后
### 先看组件日志
果然很容易就发现了问题，如下异常
```shell
# docker info
WARNING: IPv4 forwarding is disabled
WARNING: bridge-nf-call-iptables is disabled
WARNING: bridge-nf-call-ip6tables is disabled 
[root@master192 ~]# tail -fn 10000 /var/log/messages | grep disabled
Dec  5 10:13:49 master192 dockerd: time="2024-12-05T10:13:49.019171936+08:00" level=warning msg="IPv4 forwarding is disabled. Networking will not work."
Dec  5 10:13:49 master192 dockerd: time="2024-12-05T10:13:49.083035734+08:00" level=warning msg="IPv4 forwarding is disabled. Networking will not work."
Dec  5 10:13:50 master192 dockerd: time="2024-12-05T10:13:50.134821305+08:00" level=warning msg="IPv4 forwarding is disabled. Networking will not work."
Dec  5 10:13:50 master192 dockerd: time="2024-12-05T10:13:50.315765786+08:00" level=warning msg="IPv4 forwarding is disabled. Networking will not work."
```
破案了，问题是网络转发被禁用了，检查/etc/sysctl.conf，发现配置丢失了，添加如下配置
```shell
echo "net.bridge.bridge-nf-call-iptables=1" >> /etc/sysctl.conf

echo "net.bridge.bridge-nf-call-ip6tables=1" >> /etc/sysctl.conf

sysctl -p

```
**不要忘记还要重启docker**
### 检查环境是否恢复
确定集群恢复正常，业务访问正常
### 检查其他客户环境是否存在相同问题
发现最近部署的客户都有类似问题，只是还没有暴露出来 
### 寻找根因
```shell
# 关键是重启网络后没有自动开启转发，但是重启docker会自动开启转发，所以重启服务器和重启网络看到的现象不一样。
# https://forums.docker.com/t/docker-daemon-automatically-enables-ip-forwarding-in-host-os/141590
# 至于net.bridge.bridge-nf-call-iptables 直接添加到sysctl.conf中是不会被覆盖的 但是在

[root@master193 ~]# cat /usr/lib/sysctl.d/* | grep -i  bridge.bridge-nf-call-iptables
net.bridge.bridge-nf-call-iptables = 0

# 这个参数值为关闭，所以在没有额外配置的情况下 restart network 而 未restart docker 会导致转发失效

# 环境初始化的脚本中是忽略错误的，下面的命令不是幂等的，拆分一下

  - name: linux env
    shell: systemctl stop firewalld && systemctl disable firewalld && sed -i 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/sysconfig/selinux && setenforce 0 && echo "net.bridge.bridge-nf-call-iptables = 1" > /etc/sysctl.conf && modprobe br_netfilter &&  sysctl -p /etc/sysctl.conf && sed -i 's/SELINUX=enforcing/SELINUX=disabled/g' /etc/selinux/config
    ignore_errors: yes
```
## 复盘
1. 不要使用经验排查问题，排错就是stepbystep，操之过急偶尔有奇效，但是遇到问题一定要有思路，
2. 故障处理一定要检查现场是否完全修复，不能处理一半

