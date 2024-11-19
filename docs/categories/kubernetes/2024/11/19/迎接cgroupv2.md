---
title: 迎接cgroupv2
date: 2024-11-19 00:00:00
categories:
  - kubernetes
tags:
  - cgroup
  - cgroupv2
  - k8s
  - systemd
---
# 迎接cgroupv2
::: tip
control groups(控制组)，通常被称为 cgroup，是 Linux 内核的一项功能。它允许将进程组织成分层的组，然后限制和监控各种资源的使用。 内核的 cgroup 接口是通过一个叫做 cgroupfs 的伪文件系统提供的。 分组是在核心的 cgroup 内核代码中实现的，而资源跟踪和限制是在一组每个资源类型的子系统中实现的（内存、CPU 等等）。
:::
最近给客户做了一次版本升级，升级后资源限制失效了，所有的java pod都无法正常启动， 直接oom了，排查发现是我们的计算资源限制失效了，原因是现在默认的cgroup版本是v2，而我们之前使用的是v1。Kubernetes 自 v1.25 起 cgroup2 特性正式 stable :wave::wave::wave:
## 要求
```shell
cgroup v2 具有以下要求：

操作系统发行版启用 cgroup v2
Linux 内核为 5.8 或更高版本
容器运行时支持 cgroup v2。例如：
containerd v1.4 和更高版本
cri-o v1.20 和更高版本
kubelet 和容器运行时被配置为使用 systemd cgroup 驱动
Linux 发行版 cgroup v2 支持
有关使用 cgroup v2 的 Linux 发行版的列表， 请参阅 cgroup v2 文档。

Container-Optimized OS（从 M97 开始）
Ubuntu（从 21.10 开始，推荐 22.04+）
Debian GNU/Linux（从 Debian 11 Bullseye 开始）
Fedora（从 31 开始）
Arch Linux（从 2021 年 4 月开始）
RHEL 和类似 RHEL 的发行版（从 9 开始）
```
## jvm & cgroup
众说周知jvm在最早的时候是不支持感知容器资源限制的，因此在容器中运行jvm时，需要额外的配置，以便jvm能够感知到容器的资源限制。    
在8u131版本之后，jvm支持了cgroup限制。
```shell
ENV JAVA_OPTS="-XX:+UseContainerSupport -XX:InitialRAMPercentage=50 -XX:MaxRAMPercentage=80"
```
在8u372版本之后，jvm支持了cgroup v2限制。
## 如何查看jvm检测到的cgroup版本
- 使用-XshowSettings:system
```shell
[root@357fec96b37e /]# /opt/jdk8u372/bin/java -XshowSettings:system -version
Operating System Metrics:
    Provider: cgroupv2
    Effective CPU Count: 3
    CPU Period: 100000us
    CPU Quota: 300000us
    CPU Shares: -1
    List of Processors: N/A
    List of Effective Processors, 4 total: 
    0 1 2 3 
    List of Memory Nodes: N/A
    List of Available Memory Nodes, 1 total: 
    0 
    Memory Limit: 500.00M
    Memory Soft Limit: 0.00K
    Memory & Swap Limit: 500.00M

openjdk version "1.8.0_372-beta"
OpenJDK Runtime Environment (Temurin)(build 1.8.0_372-beta-202303201451-b05)
OpenJDK 64-Bit Server VM (Temurin)(build 25.372-b05, mixed mode)
```
- 使用 -XX:+UnlockDiagnosticVMOptions -XX:+PrintContainerInfo
```shell
[root@357fec96b37e /]# /opt/jdk8u372/bin/java -XX:+UnlockDiagnosticVMOptions -XX:+PrintContainerInfo -version
OSContainer::init: Initializing Container Support
Detected cgroups v2 unified hierarchy
Path to /cpu.max is /sys/fs/cgroup//cpu.max
Raw value for CPU quota is: 300000
CPU Quota is: 300000
Path to /cpu.max is /sys/fs/cgroup//cpu.max
CPU Period is: 100000
Path to /cpu.weight is /sys/fs/cgroup//cpu.weight
Raw value for CPU Shares is: 100
CPU Shares is: -1
CPU Quota count based on quota/period: 3
OSContainer::active_processor_count: 3
CgroupSubsystem::active_processor_count (cached): 3
total physical memory: 5033832448
Path to /memory.max is /sys/fs/cgroup//memory.max
Raw value for memory limit is: 524288000
Memory Limit is: 524288000
total container memory: 524288000
total container memory: 524288000
CgroupSubsystem::active_processor_count (cached): 3
Path to /cpu.max is /sys/fs/cgroup//cpu.max
Raw value for CPU quota is: 300000
CPU Quota is: 300000
Path to /cpu.max is /sys/fs/cgroup//cpu.max
CPU Period is: 100000
Path to /cpu.weight is /sys/fs/cgroup//cpu.weight
Raw value for CPU Shares is: 100
CPU Shares is: -1
CPU Quota count based on quota/period: 3
OSContainer::active_processor_count: 3
openjdk version "1.8.0_372-beta"
OpenJDK Runtime Environment (Temurin)(build 1.8.0_372-beta-202303201451-b05)
OpenJDK 64-Bit Server VM (Temurin)(build 25.372-b05, mixed mode)
```
## 判断本地运行版本
- cgroup 版本取决于正在使用的 Linux 发行版和操作系统上配置的默认 cgroup 版本。 要检查你的发行版使用的是哪个 cgroup 版本，请在该节点上运行
```shell
stat -fc %T /sys/fs/cgroup/
```
对于 cgroup v2，输出为 cgroup2fs；对于 cgroup v1，输出为 tmpfs。
- 运行 mount | grep cgroup 命令。如果输出显示 cgroup2，则系统正在使用 cgroup v2。 对于 cgroup v1，通常会看到多个 cgroup 子系统的挂载点，例如 cpu, memory, pids 等
## patch后的计算脚本
```shell

if [ -z ${MaxRAMPercentage} ]; then
  MaxRAMPercentage='50.0'
fi

if [ ! -z ${UseXmx} ]; then
  a_integer="${MaxRAMPercentage%.*}"
  # cgroup v1
  limit_v1=/sys/fs/cgroup/memory/memory.limit_in_bytes
  # cgroup v2
  limit_v2=/sys/fs/cgroup/memory.max
  if [ -e $limit_v1 ]; then
    b_integer=`cat $limit_v1`
  elif [ -e $limit_v2 ]; then
    b_integer=`cat $limit_v2`
  else
    # default max 12Gi
    echo "WARN: can't read limits, limits to 12Gi"
    b_integer=12884901888
  fi
  c=$((b_integer * a_integer / 1024 / 1024 / 100))
  JAVA_OPTS="${JAVA_OPTS} -Xmx${c}M"
else
  JAVA_OPTS="${JAVA_OPTS} -XX:MaxRAMPercentage=${MaxRAMPercentage}"
fi
```
THAT'S ALL! :wave::wave::wave: