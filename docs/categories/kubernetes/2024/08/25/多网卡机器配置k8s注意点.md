---
title: 多网卡机器配置k8s注意点
date: 2024-08-25 08:00:00
categories: 
  - kubernetes
tags:
  - k8s
  - network
  - multi-nic
---
# 多网卡机器配置k8s注意点
::: tip
多网卡机器如果不做特殊处理，可能会导致k8s集群中的pod无法访问外部网络，或者无法访问集群内部的服务。
:::
## kubeadm初始化
在初始化k8s集群的时候，如果机器有多个网卡，需要指定`--apiserver-advertise-address`参数，否则会导致apiserver监听的地址不是我们期望的地址，导致集群内部的服务无法访问。
```YAML
apiVersion: kubeadm.k8s.io/v1beta2
kind: InitConfiguration
localAPIEndpoint:
  advertiseAddress: {{ip}}
  bindPort: 6443
```
## 节点加入集群同上
```shell
 kubeadm join --apiserver-advertise-address={{ip}} 
```
## kubelet配置
在kubelet配置文件中，需要指定`--node-ip`参数，否则会导致集群内部的服务无法访问。
```shell
[root@node193 ~]# cat /var/lib/kubelet/kubeadm-flags.env 
KUBELET_KUBEADM_ARGS="--network-plugin=cni --pod-infra-container-image=registry.cn-hangzhou.aliyuncs.com/google_containers/pause:3.2"
KUBELET_EXTRA_ARGS="--node-ip=193.169.203.15"
```
## 在一些网络插件中有时候也需要特殊配置
TODO 待补充
