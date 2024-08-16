---
title: kubeadm部署集群如何个性化调整kubelet配置
isOriginal: true
author: 宇峰
date: 2024/08/16 22:25
categories:
  - kubernetes
tags:
  - kubeadm
  - kubelet
---
# kubeadm部署集群如何个性化调整kubelet配置
特性状态：Kubernetes v1.11 [stable]   
kubeadm CLI 工具的生命周期与 kubelet 解耦；kubelet 是一个守护程序，在 Kubernetes 集群中的每个节点上运行。 当 Kubernetes 初始化或升级时，kubeadm CLI 工具由用户执行，而 kubelet 始终在后台运行。  
集群中涉及的所有 kubelet 的一些配置细节都必须相同, 但是由于硬件、操作系统、网络或者其他主机特定参数的差异,某些主机需要特定的 kubelet 配置.
## 直接修改kubelet配置文件
这种方法生效快，直接高效，但是不推荐，因为这种方式会导致配置文件的不一致，不利于维护。
## /var/lib/kubelet/kubeadm-flags.env
官方推荐   
kubeadm 的解决方法是将环境文件写入 /var/lib/kubelet/kubeadm-flags.env，其中包含了一个标志列表， 当 kubelet 启动时，该标志列表会传递给 kubelet。
```shell
[root@node193 ~]# cat /var/lib/kubelet/kubeadm-flags.env 
KUBELET_KUBEADM_ARGS="--network-plugin=cni --pod-infra-container-image=registry.cn-hangzhou.aliyuncs.com/google_containers/pause:3.2"
KUBELET_EXTRA_ARGS="--node-ip=193.169.203.15"
```
KUBELET_EXTRA_ARGS 在标志链中排在最后，并且在设置冲突时具有最高优先级。

## 参考文章
- [使用 kubeadm 配置集群中的每个 kubelet](https://kubernetes.io/zh-cn/docs/setup/production-environment/tools/kubeadm/kubelet-integration/)